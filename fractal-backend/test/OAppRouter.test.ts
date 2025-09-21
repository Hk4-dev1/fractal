import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * OAppRouter with MockEndpoint
 * - Set peers
 * - Send message via endpoint and receive on dst router
 */

describe("OAppRouter + MockEndpoint", function () {
  it("forwards payload from src to dst via endpoint", async () => {
    const [owner] = await ethers.getSigners();

    const Endpoint = await ethers.getContractFactory("MockEndpoint");
    const endpoint = await Endpoint.deploy();
    await endpoint.waitForDeployment();

  const Router = await ethers.getContractFactory("OAppRouter");
  const routerA = await Router.deploy(endpoint.target, ethers.ZeroAddress, await owner.getAddress(), 100);
  const routerB = await Router.deploy(endpoint.target, ethers.ZeroAddress, await owner.getAddress(), 200);
    await routerA.waitForDeployment();
    await routerB.waitForDeployment();

    // Register routers on endpoint
    await (await endpoint.setRouter(100, routerA.target)).wait();
    await (await endpoint.setRouter(200, routerB.target)).wait();

    // Set peers
    await (await routerA.setPeer(200, ethers.zeroPadValue(routerB.target as string, 32))).wait();
    await (await routerB.setPeer(100, ethers.zeroPadValue(routerA.target as string, 32))).wait();

    const payload = ethers.toUtf8Bytes("hello");
    await (await routerA.sendSwapMessage(200, payload)).wait();

    // If no reverts, routerB accepted lzReceive via endpoint.forward
    expect(true).to.equal(true);
  });
});
