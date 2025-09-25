// Deploys MockUSDC and AMM, mints initial USDC, approves and seeds initial liquidity using viem via hardhat-viem.
// Env vars (optional):
//   AMM_FEE_BPS (default 30)
//   INITIAL_ETH_LIQUIDITY (default 10)
//   INITIAL_USDC_LIQUIDITY (default 20000)
//   LP_NAME (default ETHsep/mockUSDC)
//   LP_SYMBOL (default ETHsep/mockUSDC)
import * as dotenv from "dotenv";
import { viem } from "hardhat"; // provided by @nomicfoundation/hardhat-viem
import { parseEther, parseUnits } from "viem";
import { logStep, time } from './core/log';
import { isDryRun } from './core/flags';

dotenv.config();

async function main() {
  const feeBps = Number(process.env.AMM_FEE_BPS ?? 30);
  const initialEth = parseEther(String(process.env.INITIAL_ETH_LIQUIDITY ?? "10"));
  const initialUsdc = parseUnits(String(process.env.INITIAL_USDC_LIQUIDITY ?? "20000"), 6);

  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  logStep('deploy:init', { deployer: deployer.account.address, dryRun: isDryRun });

  // Deploy MockUSDC (constructor: name, symbol, decimals, initialSupply)
  let usdcAddr: string; let usdcAbi: any;
  if(isDryRun){
    usdcAddr = '0x000000000000000000000000000000000000dEaD';
    logStep('deploy:mockUSDC:skip');
  } else {
    const usdc = await time('deploy:MockUSDC', () => viem.deployContract("MockUSDC", ["MockUSDC", "mUSDC", 6, 0]));
    usdcAddr = usdc.address; usdcAbi = usdc.abi;
    logStep('deploy:mockUSDC:ok', { address: usdcAddr });
  }

  // Mint initial USDC to deployer
  if(!isDryRun){
    await time('mint:USDC', () => deployer.writeContract({
      address: usdcAddr as `0x${string}`,
      abi: usdcAbi,
      functionName: "mint",
      args: [deployer.account.address, initialUsdc]
    }));
    logStep('mint:usdc', { to: deployer.account.address, amount: initialUsdc.toString() });
  }

  // Deploy AMM (constructor: usdc, feeBps, lpName, lpSymbol)
  const lpName = process.env.LP_NAME ?? "ETHsep/mockUSDC";
  const lpSymbol = process.env.LP_SYMBOL ?? "ETHsep/mockUSDC";
  let ammAddr: string; let ammAbi: any;
  if(isDryRun){
    ammAddr = '0x000000000000000000000000000000000000aAaA';
    logStep('deploy:amm:skip');
  } else {
    const amm = await time('deploy:AMM', () => viem.deployContract("AMM", [usdcAddr, BigInt(feeBps), lpName, lpSymbol]));
    ammAddr = amm.address; ammAbi = amm.abi;
    logStep('deploy:amm:ok', { address: ammAddr });
  }

  // Approve USDC to AMM
  if(!isDryRun){
    await time('approve:usdc', () => deployer.writeContract({ address: usdcAddr as `0x${string}`, abi: usdcAbi, functionName: "approve", args: [ammAddr, initialUsdc] }));
    logStep('approve:usdc', { amm: ammAddr, amount: initialUsdc.toString() });
  }

  // Add initial liquidity (eth value + usdc amount)
  if(!isDryRun){
    await time('amm:addLiquidity', () => deployer.writeContract({ address: ammAddr as `0x${string}`, abi: ammAbi, functionName: "addLiquidity", args: [initialUsdc], value: initialEth }));
    logStep('amm:addLiquidity', { eth: initialEth.toString(), usdc: initialUsdc.toString() });
  }

  // Read reserves
  if(!isDryRun){
  const [ethRes, usdcRes] = await publicClient.readContract({ address: ammAddr as `0x${string}`, abi: ammAbi, functionName: "getReserves", args: [] }) as [bigint,bigint];
    logStep('amm:reserves', { eth: ethRes.toString(), usdc: usdcRes.toString() });
  }
  logStep('deploy:complete', { usdc: usdcAddr, amm: ammAddr });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
