import { expect } from "chai";
import { ethers } from "hardhat";

describe("AMM invariants and events", function () {
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

  it("product k increases after swaps due to fees", async () => {
    const { user, amm, usdc } = await setup();
    const [e0, u0] = await amm.getReserves();
    const k0 = e0 * u0;

    await (await (amm.connect(user) as any).swapETHForUSDC(0n, { value: ethers.parseEther("1") })).wait();
    let [e1, u1] = await amm.getReserves();
    const k1 = e1 * u1;
    expect(k1).to.be.gt(k0);

    await (await (usdc.connect(user) as any).approve(amm.target, ethers.parseUnits("1000", 6))).wait();
    await (await (amm.connect(user) as any).swapUSDCForETH(ethers.parseUnits("1000", 6), 0n)).wait();
    const [e2, u2] = await amm.getReserves();
    const k2 = e2 * u2;
    expect(k2).to.be.gt(k1);
  });

  it("remove all liquidity drains pool and zeroes supply", async () => {
    const { deployer, amm } = await setup();
    const total = await (amm as any).balanceOf(await deployer.getAddress());
    await (await amm.removeLiquidity(total)).wait();
    const [e, u] = await amm.getReserves();
    expect(e).to.equal(0);
    expect(u).to.equal(0);
    const ts = await (amm as any).totalSupply();
    expect(ts).to.equal(0);
  });

  it("emits SwapExecuted with correct token addresses", async () => {
    const { user, amm, usdc } = await setup();

    // ETH -> USDC
    const tx1 = await (amm.connect(user) as any).swapETHForUSDC(0n, { value: ethers.parseEther("1") });
    const rc1 = await tx1.wait();
    const ev1 = rc1!.logs
      .map((l: any) => {
        try { return (amm as any).interface.parseLog({ topics: l.topics, data: l.data }); } catch { return undefined; }
      })
      .find((ev: any) => ev && ev.name === "SwapExecuted");
    expect(ev1.args.tokenIn).to.equal(ethers.ZeroAddress);
    expect(ev1.args.tokenOut).to.equal(usdc.target);

    // USDC -> ETH
    await (await (usdc.connect(user) as any).approve(amm.target, ethers.parseUnits("1000", 6))).wait();
    const tx2 = await (amm.connect(user) as any).swapUSDCForETH(ethers.parseUnits("1000", 6), 0n);
    const rc2 = await tx2.wait();
    const ev2 = rc2!.logs
      .map((l: any) => {
        try { return (amm as any).interface.parseLog({ topics: l.topics, data: l.data }); } catch { return undefined; }
      })
      .find((ev: any) => ev && ev.name === "SwapExecuted");
    expect(ev2.args.tokenIn).to.equal(usdc.target);
    expect(ev2.args.tokenOut).to.equal(ethers.ZeroAddress);
  });

  it("getLPBalance mirrors ERC20 balanceOf", async () => {
    const { deployer, amm } = await setup();
    const a = await amm.getLPBalance(await deployer.getAddress());
    const b = await (amm as any).balanceOf(await deployer.getAddress());
    expect(a).to.equal(b);
  });
});
