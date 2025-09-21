import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Minimal tests for EscrowCore + SimpleRouter:
 * - Create ETH order (fees to treasuries), cancel, and execute via router
 * - Create ERC20 order (USDC) and execute via router
 */

describe("EscrowCore", function () {
  it("create ETH order, cancel, and execute via router (separate flows)", async () => {
    const [owner, user, treasuryE, treasuryP, recipient] = await ethers.getSigners();

    // Deploy EscrowCore
    const Escrow = await ethers.getContractFactory("EscrowCore");
    const escrow = await Escrow.deploy(
      await owner.getAddress(),
      50, // 0.5% escrow fee
      20, // 0.2% protocol fee
      await treasuryE.getAddress(),
      await treasuryP.getAddress()
    );
    await escrow.waitForDeployment();

    // Set router
    const Router = await ethers.getContractFactory("SimpleRouter");
    const router = await Router.deploy(escrow.target, await owner.getAddress());
    await router.waitForDeployment();
  await (await (escrow as any).connect(owner).setRouter(router.target)).wait();

    // Create an ETH order
    const amountIn = ethers.parseEther("1");
  const tx = await (escrow as any).connect(user).createOrder(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      amountIn,
      0n,
      0,
      { value: amountIn }
    );
  const rc = await tx.wait();
  const ev = rc!.logs.map((l: any) => (l as any).args).find((a: any) => a && a.id);
    const id = ev.id as bigint;

    // Cancel it and get refund of net
  await (await (escrow as any).connect(user).cancelOrder(id)).wait();
    const ord = await escrow.getOrder(id);
    expect(ord.status).to.equal(2); // Cancelled

    // Create another ETH order, then execute via router
  const tx2 = await (escrow as any).connect(user).createOrder(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      amountIn,
      0n,
      0,
      { value: amountIn }
    );
  const rc2 = await tx2.wait();
  const ev2 = rc2!.logs.map((l: any) => (l as any).args).find((a: any) => a && a.id);
    const id2 = ev2.id as bigint;

    const payload = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","address","uint256"], [id2, await recipient.getAddress(), 0n]);
  await (await (router as any).lzReceive(0, payload)).wait();
    const ord2 = await escrow.getOrder(id2);
    expect(ord2.status).to.equal(3); // Executed
  });

  it("create ERC20 order and execute via router", async () => {
    const [owner, user, treasuryE, treasuryP, recipient] = await ethers.getSigners();

    // Deploy mock USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy("MockUSDC", "mUSDC", 6, 0);
    await usdc.waitForDeployment();
    await (await usdc.mint(await user.getAddress(), ethers.parseUnits("10000", 6))).wait();

    // Deploy EscrowCore
    const Escrow = await ethers.getContractFactory("EscrowCore");
    const escrow = await Escrow.deploy(
      await owner.getAddress(),
      50,
      20,
      await treasuryE.getAddress(),
      await treasuryP.getAddress()
    );
    await escrow.waitForDeployment();

    // Router
    const Router = await ethers.getContractFactory("SimpleRouter");
    const router = await Router.deploy(escrow.target, await owner.getAddress());
    await router.waitForDeployment();
  await (await (escrow as any).connect(owner).setRouter(router.target)).wait();

    // Create ERC20 order
  await (await (usdc as any).connect(user).approve(escrow.target, ethers.parseUnits("10000", 6))).wait();
  const tx = await (escrow as any).connect(user).createOrder(
      usdc.target,
      ethers.ZeroAddress,
      ethers.parseUnits("1000", 6),
      0n,
      0
    );
  const rc = await tx.wait();
  const ev = rc!.logs.map((l: any) => (l as any).args).find((a: any) => a && a.id);
    const id = ev.id as bigint;

    // Execute via router
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","address","uint256"], [id, await recipient.getAddress(), 0n]);
  await (await (router as any).lzReceive(0, payload)).wait();
    const ord = await escrow.getOrder(id);
    expect(ord.status).to.equal(3);
  });
});
