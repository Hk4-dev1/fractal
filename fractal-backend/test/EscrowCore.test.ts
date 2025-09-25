import { expect } from "chai";
import { viem } from "hardhat";
import { parseUnits, parseEther, encodeAbiParameters } from 'viem';

/**
 * Minimal tests for EscrowCore + SimpleRouter:
 * - Create ETH order (fees to treasuries), cancel, and execute via router
 * - Create ERC20 order (USDC) and execute via router
 */

describe("EscrowCore (viem)", function () {
  it("create ETH order, cancel, and execute via router (separate flows)", async () => {
  const [owner, user, treasuryE, treasuryP, recipient] = await viem.getWalletClients();

    // Deploy EscrowCore
    const escrow = await viem.deployContract("EscrowCore", [
      owner.account.address,
      50,
      20,
      treasuryE.account.address,
      treasuryP.account.address
    ]);

    // Set router
  const router = await viem.deployContract("SimpleRouter", [escrow.address, owner.account.address]);
  await owner.writeContract({ address: escrow.address, abi: escrow.abi, functionName: 'setRouter', args: [router.address] });

    // Create an ETH order
    const amountIn = parseEther("1");
    const txHash1 = await user.writeContract({ address: escrow.address, abi: escrow.abi, functionName: 'createOrder', args: [
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      amountIn,
      0n,
      0
    ], value: amountIn });
    const pc = await viem.getPublicClient();
    const rc1 = await pc.getTransactionReceipt({ hash: txHash1 });
    const log1 = rc1.logs.find(l => l.address.toLowerCase() === escrow.address.toLowerCase());
  const id = log1 && log1.topics[1] ? BigInt(log1.topics[1] as string) : 1n; // simplistic extraction

    // Cancel it and get refund of net
  await user.writeContract({ address: escrow.address, abi: escrow.abi, functionName: 'cancelOrder', args: [id] });
  const ord = await pc.readContract({ address: escrow.address, abi: escrow.abi, functionName: 'getOrder', args: [id] }) as any;
    expect(ord.status).to.equal(2); // Cancelled

    // Create another ETH order, then execute via router
    const txHash2 = await user.writeContract({ address: escrow.address, abi: escrow.abi, functionName: 'createOrder', args: [
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      amountIn,
      0n,
      0
    ], value: amountIn });
    const rc2 = await pc.getTransactionReceipt({ hash: txHash2 });
    const log2 = rc2.logs.find(l => l.address.toLowerCase() === escrow.address.toLowerCase());
  const id2 = log2 && log2.topics[1] ? BigInt(log2.topics[1] as string) : 2n;
    const payload = encodeAbiParameters([
      { name: 'id', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'extra', type: 'uint256' }
    ], [id2, recipient.account.address, 0n]);
    await owner.writeContract({ address: router.address, abi: router.abi, functionName: 'lzReceive', args: [0n, payload] });
    const ord2 = await pc.readContract({ address: escrow.address, abi: escrow.abi, functionName: 'getOrder', args: [id2] }) as any;
    expect(ord2.status).to.equal(3); // Executed
  });

  it("create ERC20 order and execute via router", async () => {
  const [owner, user, treasuryE, treasuryP, recipient] = await viem.getWalletClients();

    // Deploy mock USDC
  const usdc = await viem.deployContract("MockUSDC", ["MockUSDC","mUSDC",6, 0]);
  await user.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'mint', args: [user.account.address, parseUnits('10000',6)] });

    // Deploy EscrowCore
    const escrow = await viem.deployContract("EscrowCore", [
      owner.account.address,
      50,
      20,
      treasuryE.account.address,
      treasuryP.account.address
    ]);

    // Router
  const router = await viem.deployContract("SimpleRouter", [escrow.address, owner.account.address]);
  await owner.writeContract({ address: escrow.address, abi: escrow.abi, functionName: 'setRouter', args: [router.address] });

    // Create ERC20 order
    await user.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [escrow.address, parseUnits('10000',6)] });
    const txHash = await user.writeContract({ address: escrow.address, abi: escrow.abi, functionName: 'createOrder', args: [
      usdc.address,
      '0x0000000000000000000000000000000000000000',
      parseUnits('1000',6),
      0n,
      0
    ] });
    const pc2 = await viem.getPublicClient();
    const rc = await pc2.getTransactionReceipt({ hash: txHash });
    const log = rc.logs.find(l => l.address.toLowerCase() === escrow.address.toLowerCase());
  const id = log && log.topics[1] ? BigInt(log.topics[1] as string) : 1n;

    // Execute via router
    const payload2 = encodeAbiParameters([
      { name: 'id', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'extra', type: 'uint256' }
    ], [id, recipient.account.address, 0n]);
    await owner.writeContract({ address: router.address, abi: router.abi, functionName: 'lzReceive', args: [0n, payload2] });
    const ord = await pc2.readContract({ address: escrow.address, abi: escrow.abi, functionName: 'getOrder', args: [id] }) as any;
    expect(ord.status).to.equal(3);
  });
});
