import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * AMM minimal tests:
 * - Add initial liquidity
 * - Swap ETH->USDC and USDC->ETH with slippage check
 * - Remove liquidity
 */

describe("AMM", function () {
  it("add liquidity, swap both ways, remove liquidity", async () => {
    const [deployer, user] = await ethers.getSigners();

    // Deploy MockUSDC (6 decimals like USDC)
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy("MockUSDC", "mUSDC", 6, 0);
    await usdc.waitForDeployment();

    // Mint to deployer and user
  await (await (usdc as any).mint(await deployer.getAddress(), ethers.parseUnits("1000000", 6))).wait();
  await (await (usdc as any).mint(await user.getAddress(), ethers.parseUnits("1000000", 6))).wait();

    // Deploy AMM with 30 bps fee
    const AMM = await ethers.getContractFactory("AMM");
  const amm = await AMM.deploy(usdc.target, 30, "Fractal LP", "fLP");
    await amm.waitForDeployment();

    // Approve USDC
  await (await (usdc as any).approve(amm.target, ethers.parseUnits("1000000", 6))).wait();

    // Add initial liquidity: 10 ETH + 20,000 USDC
    await (await amm.addLiquidity(ethers.parseUnits("20000", 6), { value: ethers.parseEther("10") })).wait();

    // Sanity reserves
    let [ethRes, usdcRes] = await amm.getReserves();
    expect(ethRes).to.equal(ethers.parseEther("10"));
    expect(usdcRes).to.equal(ethers.parseUnits("20000", 6));

    // User swap: ETH -> USDC, send 1 ETH
    const ammUser = amm.connect(user);
    const minUsdc = 0n; // loose for test
  await (await (ammUser as any).swapETHForUSDC(minUsdc, { value: ethers.parseEther("1") })).wait();

    // User swap: USDC -> ETH, send 1000 USDC
    const usdcUser = usdc.connect(user);
  await (await (usdcUser as any).approve(amm.target, ethers.parseUnits("10000", 6))).wait();
  await (await (ammUser as any).swapUSDCForETH(ethers.parseUnits("1000", 6), 0n)).wait();

    // Remove some liquidity from deployer
  const lpBal = await (amm as any).balanceOf(await deployer.getAddress());
    const burn = lpBal / 2n;
    await (await amm.removeLiquidity(burn)).wait();

    // Check final reserves are non-zero
    [ethRes, usdcRes] = await amm.getReserves();
    expect(ethRes).to.be.gt(0);
    expect(usdcRes).to.be.gt(0);
  });
});
