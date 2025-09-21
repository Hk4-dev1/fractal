import { expect } from "chai";
import { ethers } from "hardhat";

function mulDiv(a: bigint, b: bigint, d: bigint): bigint { return (a * b) / d; }

describe("AMM refunds and math", function () {
  async function setup() {
    const [deployer, user] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy("MockUSDC", "mUSDC", 6, 0);
    await usdc.waitForDeployment();
    await (await usdc.mint(await deployer.getAddress(), ethers.parseUnits("1000000", 6))).wait();
    await (await usdc.mint(await user.getAddress(), ethers.parseUnits("1000000", 6))).wait();

    const AMM = await ethers.getContractFactory("AMM");
    const amm = await AMM.deploy(usdc.target, 30, "ETHsep/mockUSDC", "ETHsep/mockUSDC");
    await amm.waitForDeployment();

    await (await (usdc as any).approve(amm.target, ethers.parseUnits("1000000", 6))).wait();
    await (await amm.addLiquidity(ethers.parseUnits("20000", 6), { value: ethers.parseEther("10") })).wait();

    return { deployer, user, usdc, amm };
  }

  it("refunds extra USDC when ETH is the limiting side", async () => {
    const { user, usdc, amm } = await setup();

    const userUsdcStart = await usdc.balanceOf(await user.getAddress());

    // Ratio is 2000 USDC per 1 ETH; provide 1 ETH + 3000 USDC -> expect ~1000 USDC refund
    await (await (usdc.connect(user) as any).approve(amm.target, ethers.parseUnits("3000", 6))).wait();
    await (await (amm.connect(user) as any).addLiquidity(ethers.parseUnits("3000", 6), { value: ethers.parseEther("1") })).wait();

    const userUsdcEnd = await usdc.balanceOf(await user.getAddress());
    const spent = userUsdcStart - userUsdcEnd;
    expect(spent).to.equal(ethers.parseUnits("2000", 6));
  });

  it("refunds extra ETH when USDC is the limiting side", async () => {
    const { user, usdc, amm } = await setup();

  // Provide 0.6 ETH + 500 USDC; requiredETH for 500 USDC at ratio 2000/1 = 0.25 ETH
  await (await (usdc.connect(user) as any).approve(amm.target, ethers.parseUnits("500", 6))).wait();
  const tx = await (amm.connect(user) as any).addLiquidity(ethers.parseUnits("500", 6), { value: ethers.parseEther("0.6") });
  const rc = await tx.wait();

  // Parse LiquidityAdded event to assert used amounts
    const logs = rc!.logs as any[];
    const iface = (amm as any).interface;
    const parsedLiquidity = logs
      .filter((l: any) => l.address?.toLowerCase() === (amm.target as string).toLowerCase())
      .map((l: any) => {
        try { return iface.parseLog({ topics: l.topics, data: l.data }); } catch { return undefined; }
      })
      .find((ev: any) => ev && ev.name === "LiquidityAdded");
    const ethUsed: bigint = parsedLiquidity.args.ethAmount;
    const usdcUsed: bigint = parsedLiquidity.args.usdcAmount;
  expect(ethUsed).to.equal(ethers.parseEther("0.25"));
  expect(usdcUsed).to.equal(ethers.parseUnits("500", 6));
  });

  it("fee math matches expected on ETH->USDC swap", async () => {
    const { user, usdc, amm } = await setup();

    // Read reserves
    const [ethRes0, usdcRes0] = await amm.getReserves();
    const feeBps = 30n;
    const amountIn = ethers.parseEther("1");
    const amountInAfterFee = mulDiv(amountIn, 10000n - feeBps, 10000n);
    const k = ethRes0 * usdcRes0;
    const newEth = ethRes0 + amountInAfterFee;
    const newUsdc = k / newEth;
    const expectedOut = usdcRes0 - newUsdc;

    const usdcStart = await usdc.balanceOf(await user.getAddress());
    await (await (amm.connect(user) as any).swapETHForUSDC(0n, { value: amountIn })).wait();
    const usdcEnd = await usdc.balanceOf(await user.getAddress());

    expect(usdcEnd - usdcStart).to.equal(expectedOut);
  });

  it("reverts on zero amounts", async () => {
    const { amm } = await setup();
    await expect((amm as any).swapUSDCForETH(0n, 0n)).to.be.revertedWithCustomError(amm, "InvalidAmount");
    await expect((amm as any).removeLiquidity(0n)).to.be.revertedWithCustomError(amm, "InvalidAmount");
  });
});
