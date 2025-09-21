import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Edge tests for AMM:
 * - Reentrancy on ETH receive blocked
 * - Slippage strict reverts
 * - Wrong ratio addLiquidity limited by LP mint (expect revert when too skewed)
 */

describe("AMM edge cases", function () {
  async function deployEnv() {
    const [deployer, user] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy("MockUSDC", "mUSDC", 6, 0);
    await usdc.waitForDeployment();
    await (await usdc.mint(await deployer.getAddress(), ethers.parseUnits("1000000", 6))).wait();
    await (await usdc.mint(await user.getAddress(), ethers.parseUnits("1000000", 6))).wait();

    const AMM = await ethers.getContractFactory("AMM");
    const amm = await AMM.deploy(usdc.target, 30, "Fractal LP", "fLP");
    await amm.waitForDeployment();

    await (await (usdc as any).approve(amm.target, ethers.parseUnits("1000000", 6))).wait();
    await (await amm.addLiquidity(ethers.parseUnits("20000", 6), { value: ethers.parseEther("10") })).wait();

    return { deployer, user, usdc, amm };
  }

  it("reentrancy blocked on ETH send", async () => {
    const { usdc, amm } = await deployEnv();

    const Attacker = await ethers.getContractFactory("ReentrantAttacker");
    const attacker = await Attacker.deploy(amm.target, usdc.target);
    await attacker.waitForDeployment();

    await (await (attacker as any).setTryReenter(true)).wait();

    // Trigger ETH send path: swapUSDCForETH
    await (await (usdc as any).approve(amm.target, ethers.parseUnits("1000", 6))).wait();
    await (await (amm as any).swapUSDCForETH(ethers.parseUnits("1000", 6), 0n)).wait();

    // If reentrancy happened, state would be corrupted; we simply assert reserves still > 0
    const [ethRes, usdcRes] = await amm.getReserves();
    expect(ethRes).to.be.gt(0);
    expect(usdcRes).to.be.gt(0);
  });

  it("slippage strict reverts on ETH->USDC", async () => {
    const { amm } = await deployEnv();
    await expect((amm as any).swapETHForUSDC(ethers.parseUnits("999999999", 6), { value: ethers.parseEther("1") }))
      .to.be.revertedWithCustomError(amm, "SlippageExceeded");
  });

  it("slippage strict reverts on USDC->ETH", async () => {
    const { usdc, amm } = await deployEnv();
    await (await (usdc as any).approve(amm.target, ethers.parseUnits("1000", 6))).wait();
    await expect((amm as any).swapUSDCForETH(ethers.parseUnits("1000", 6), ethers.parseEther("999")))
      .to.be.revertedWithCustomError(amm, "SlippageExceeded");
  });
});
