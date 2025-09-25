import { expect } from "chai";
import { viem } from "hardhat";
import { parseEther, encodeAbiParameters } from 'viem';

/**
 * Cross-chain E2E (mocked):
 * - Two EIDs (100, 200)
 * - Endpoint routes messages
 * - Each EID has EscrowCore + OAppRouter wired; creating order on A sends payload and executes on B
 */

describe("CrossChain E2E (mocked endpoint, viem)", function () {
  it("create order on A -> execute on B via routers", async () => {
  const [owner, user, treasuryE, treasuryP, recipient] = await viem.getWalletClients();

    // Endpoint
  const endpoint = await viem.deployContract("MockEndpoint", []);

    // Escrow A
    const escrowA = await viem.deployContract("EscrowCore", [
      owner.account.address,
      10,
      10,
      treasuryE.account.address,
      treasuryP.account.address
    ]);

    // Escrow B
    const escrowB = await viem.deployContract("EscrowCore", [
      owner.account.address,
      10,
      10,
      treasuryE.account.address,
      treasuryP.account.address
    ]);

    // Routers with escrow wiring
  const routerA = await viem.deployContract("OAppRouter", [endpoint.address, escrowA.address, owner.account.address, 100]);
  const routerB = await viem.deployContract("OAppRouter", [endpoint.address, escrowB.address, owner.account.address, 200]);

    // Register routers on endpoint
  await owner.writeContract({ address: endpoint.address, abi: endpoint.abi, functionName: 'setRouter', args: [100, routerA.address] });
  await owner.writeContract({ address: endpoint.address, abi: endpoint.abi, functionName: 'setRouter', args: [200, routerB.address] });

    // Set peers (not strictly used by MockEndpoint but mirrors real setup)
  function pad32(addr: string): `0x${string}` { return ('0x' + addr.replace(/^0x/, '').padStart(64, '0')) as `0x${string}`; }
  await owner.writeContract({ address: routerA.address, abi: routerA.abi, functionName: 'setPeer', args: [200, pad32(routerB.address)] });
  await owner.writeContract({ address: routerB.address, abi: routerB.abi, functionName: 'setPeer', args: [100, pad32(routerA.address)] });

    // Allow routerB to call escrowB by setting router on escrowB
  await owner.writeContract({ address: escrowA.address, abi: escrowA.abi, functionName: 'setRouter', args: [routerA.address] });
  await owner.writeContract({ address: escrowB.address, abi: escrowB.abi, functionName: 'setRouter', args: [routerB.address] });

    // Create an ETH order ID on B first (to simulate a corresponding order entry on dest)
    const txHashB = await owner.writeContract({ address: escrowB.address, abi: escrowB.abi, functionName: 'createOrder', args: [
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      parseEther('1'),
      0n,
      0
    ], value: parseEther('1') });
    const pc = await viem.getPublicClient();
    const rcB = await pc.getTransactionReceipt({ hash: txHashB });
    const logB = rcB.logs.find(l => l.address.toLowerCase() === escrowB.address.toLowerCase());
    const idB = logB && logB.topics[1] ? BigInt(logB.topics[1] as string) : 1n;

    // User creates an ETH order on A; send payload to B to execute to recipient (carrying idB for dest)
    const amountIn = parseEther('1');
    const txHashA = await user.writeContract({ address: escrowA.address, abi: escrowA.abi, functionName: 'createOrder', args: [
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      amountIn,
      0n,
      200
    ], value: amountIn });
    const rcA = await pc.getTransactionReceipt({ hash: txHashA });
    const logA = rcA.logs.find(l => l.address.toLowerCase() === escrowA.address.toLowerCase());
    const id = logA && logA.topics[1] ? BigInt(logA.topics[1] as string) : 1n;

  // Router A sends message to B, with the destination order id (sendSwapMessage internally forwards via endpoint)
    const payload = encodeAbiParameters([
      { name: 'id', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'extra', type: 'uint256' }
    ], [idB, recipient.account.address, 0n]);
    await owner.writeContract({ address: routerA.address, abi: routerA.abi, functionName: 'sendSwapMessage', args: [200, payload] });

  // Assert order executed on B via routerB.lzReceive -> escrowB.executeFromRemote
  const ordB = await pc.readContract({ address: escrowB.address, abi: escrowB.abi, functionName: 'getOrder', args: [idB] }) as any;
    expect(ordB.status).to.equal(3); // Executed
  });
});
