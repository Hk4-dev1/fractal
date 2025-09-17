import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const feeBps = Number(process.env.AMM_FEE_BPS ?? 30);
  const initialEth = BigInt(ethers.parseEther(String(process.env.INITIAL_ETH_LIQUIDITY ?? "10")));
  const initialUsdc = BigInt(ethers.parseUnits(String(process.env.INITIAL_USDC_LIQUIDITY ?? "20000"), 6));

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", await deployer.getAddress());

  // Deploy MockUSDC (6 decimals)
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy("MockUSDC", "mUSDC", 6, 0);
  await usdc.waitForDeployment();
  console.log("MockUSDC:", usdc.target);

  // Mint initial USDC to deployer
  await (await usdc.mint(await deployer.getAddress(), initialUsdc)).wait();

  // Deploy AMM
  const lpName = process.env.LP_NAME ?? "ETHsep/mockUSDC";
  const lpSymbol = process.env.LP_SYMBOL ?? "ETHsep/mockUSDC";
  const AMM = await ethers.getContractFactory("AMM");
  const amm = await AMM.deploy(usdc.target, feeBps, lpName, lpSymbol);
  await amm.waitForDeployment();
  console.log("AMM:", amm.target);

  // Approve and add initial liquidity
  await (await usdc.approve(amm.target, initialUsdc)).wait();
  await (await amm.addLiquidity(initialUsdc, { value: initialEth })).wait();

  const [ethRes, usdcRes] = await amm.getReserves();
  console.log("Reserves:", ethRes.toString(), usdcRes.toString());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
