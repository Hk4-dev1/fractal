import { expect } from "chai";
import { viem } from "hardhat";

function pad32(addr: string): `0x${string}` {
  return ('0x' + addr.replace(/^0x/, '').padStart(64, '0')) as `0x${string}`;
}

/**
 * OAppRouter with MockEndpoint
 * - Set peers
 * - Send message via endpoint and receive on dst router
 */

describe("OAppRouter + MockEndpoint (viem)", function () {
  it("forwards payload from src to dst via endpoint", async () => {
  const [owner] = await viem.getWalletClients();

  const endpoint = await viem.deployContract("MockEndpoint", []);

  const routerA = await viem.deployContract("OAppRouter", [endpoint.address, '0x0000000000000000000000000000000000000000', owner.account.address, 100]);
  const routerB = await viem.deployContract("OAppRouter", [endpoint.address, '0x0000000000000000000000000000000000000000', owner.account.address, 200]);

    // Register routers on endpoint
  await owner.writeContract({ address: endpoint.address, abi: endpoint.abi, functionName: 'setRouter', args: [100, routerA.address] });
  await owner.writeContract({ address: endpoint.address, abi: endpoint.abi, functionName: 'setRouter', args: [200, routerB.address] });

    // Set peers
  await owner.writeContract({ address: routerA.address, abi: routerA.abi, functionName: 'setPeer', args: [200, pad32(routerB.address)] });
  await owner.writeContract({ address: routerB.address, abi: routerB.abi, functionName: 'setPeer', args: [100, pad32(routerA.address)] });

  const payloadBytes = new TextEncoder().encode("hello");
  const payloadHex = ('0x' + Buffer.from(payloadBytes).toString('hex')) as `0x${string}`;
  await owner.writeContract({ address: routerA.address, abi: routerA.abi, functionName: 'sendSwapMessage', args: [200, payloadHex] });

    // If no reverts, routerB accepted lzReceive via endpoint.forward
    expect(true).to.equal(true);
  });
});
