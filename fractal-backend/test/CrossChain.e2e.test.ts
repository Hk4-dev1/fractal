import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Cross-chain E2E (mocked):
 * - Two EIDs (100, 200)
 * - Endpoint routes messages
 * - Each EID has EscrowCore + OAppRouter wired; creating order on A sends payload and executes on B
 */

describe("CrossChain E2E (mocked endpoint)", function () {
  it("create order on A -> execute on B via routers", async () => {
    const [owner, user, treasuryE, treasuryP, recipient] = await ethers.getSigners();

    // Endpoint
    const Endpoint = await ethers.getContractFactory("MockEndpoint");
    const endpoint = await Endpoint.deploy();
    await endpoint.waitForDeployment();

    // Escrow A
    const Escrow = await ethers.getContractFactory("EscrowCore");
    const escrowA = await Escrow.deploy(
      await owner.getAddress(),
      10, // 0.1%
      10, // 0.1%
      await treasuryE.getAddress(),
      await treasuryP.getAddress()
    );
    await escrowA.waitForDeployment();

    // Escrow B
    const escrowB = await Escrow.deploy(
      await owner.getAddress(),
      10,
      10,
      await treasuryE.getAddress(),
      await treasuryP.getAddress()
    );
    await escrowB.waitForDeployment();

    // Routers with escrow wiring
    const Router = await ethers.getContractFactory("OAppRouter");
  const routerA = await Router.deploy(endpoint.target, escrowA.target, await owner.getAddress(), 100);
  const routerB = await Router.deploy(endpoint.target, escrowB.target, await owner.getAddress(), 200);
    await routerA.waitForDeployment();
    await routerB.waitForDeployment();

    // Register routers on endpoint
    await (await endpoint.setRouter(100, routerA.target)).wait();
    await (await endpoint.setRouter(200, routerB.target)).wait();

    // Set peers (not strictly used by MockEndpoint but mirrors real setup)
    await (await routerA.setPeer(200, ethers.zeroPadValue(routerB.target as string, 32))).wait();
    await (await routerB.setPeer(100, ethers.zeroPadValue(routerA.target as string, 32))).wait();

    // Allow routerB to call escrowB by setting router on escrowB
    await (await escrowA.setRouter(routerA.target)).wait();
    await (await escrowB.setRouter(routerB.target)).wait();

    // Create an ETH order ID on B first (to simulate a corresponding order entry on dest)
    const txB = await (escrowB as any).connect(owner).createOrder(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.parseEther("1"),
      0n,
      0,
      { value: ethers.parseEther("1") }
    );
    const rcB = await txB.wait();
    const evB = rcB!.logs.map((l: any) => (l as any).args).find((a: any) => a && a.id);
    const idB = evB.id as bigint;

    // User creates an ETH order on A; send payload to B to execute to recipient (carrying idB for dest)
    const amountIn = ethers.parseEther("1");
    const tx = await (escrowA as any).connect(user).createOrder(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      amountIn,
      0n,
      200,
      { value: amountIn }
    );
    const rc = await tx.wait();
    const ev = rc!.logs.map((l: any) => (l as any).args).find((a: any) => a && a.id);
    const id = ev.id as bigint;

  // Router A sends message to B, with the destination order id (sendSwapMessage internally forwards via endpoint)
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","address","uint256"], [idB, await recipient.getAddress(), 0n]);
    await (await routerA.sendSwapMessage(200, payload)).wait();

  // Assert order executed on B via routerB.lzReceive -> escrowB.executeFromRemote
    const ordB = await escrowB.getOrder(idB);
    expect(ordB.status).to.equal(3); // Executed
  });
});
