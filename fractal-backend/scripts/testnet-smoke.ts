import * as dotenv from "dotenv";
import { viem } from "hardhat";
import { parseEther } from "viem";
import { logStep, time } from './core/log';
import { isDryRun } from './core/flags';

dotenv.config();

async function main() {
  const [signer] = await viem.getWalletClients();
  const me = signer.account.address;
  logStep('smoke:init', { signer: me, dryRun: isDryRun });

  const escrowAddr = process.env.ESCROW_ADDRESS;
  if (!escrowAddr) throw new Error("Set ESCROW_ADDRESS in .env for the selected --network");

  const escrowAbi = [
    "function treasuryEscrow() view returns (address)",
    "function treasuryProtocol() view returns (address)",
    "function escrowFeeBps() view returns (uint256)",
    "function protocolFeeBps() view returns (uint256)",
    "function nextOrderId() view returns (uint256)",
    "function getOrder(uint256) view returns (tuple(address maker,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid,uint256 createdAt,uint8 status))",
    "function createOrder(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid) payable returns (uint256)",
    "function executeFromRemote(uint256 id, address to, uint256 minOut)"
  ];

  const publicClient = await viem.getPublicClient();
  const escrowIfaceRead = escrowAbi.map((sig) => sig); // keep list for read
  // Minimal ABI objects for read/write
  const ABI = [
    { type: 'function', name: 'treasuryEscrow', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'treasuryProtocol', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { type: 'function', name: 'escrowFeeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'protocolFeeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'nextOrderId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'getOrder', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'tuple', components: [
      { name: 'maker', type: 'address' },
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'dstEid', type: 'uint64' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'status', type: 'uint8' }
    ] }] },
    { type: 'function', name: 'createOrder', stateMutability: 'payable', inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'dstEid', type: 'uint64' }
    ], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'executeFromRemote', stateMutability: 'nonpayable', inputs: [
      { name: 'id', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'minOut', type: 'uint256' }
    ], outputs: [] }
  ];

  const tEscrow: string = await publicClient.readContract({ address: escrowAddr as `0x${string}`, abi: ABI as any, functionName: 'treasuryEscrow', args: [] }) as any;
  const tProtocol: string = await publicClient.readContract({ address: escrowAddr as `0x${string}`, abi: ABI as any, functionName: 'treasuryProtocol', args: [] }) as any;
  const feeEscrow: bigint = await publicClient.readContract({ address: escrowAddr as `0x${string}`, abi: ABI as any, functionName: 'escrowFeeBps', args: [] }) as any;
  const feeProtocol: bigint = await publicClient.readContract({ address: escrowAddr as `0x${string}`, abi: ABI as any, functionName: 'protocolFeeBps', args: [] }) as any;
  const nextId: bigint = await publicClient.readContract({ address: escrowAddr as `0x${string}`, abi: ABI as any, functionName: 'nextOrderId', args: [] }) as any;

  logStep('smoke:treasuries', { tEscrow, tProtocol, feeEscrow: feeEscrow.toString(), feeProtocol: feeProtocol.toString(), nextId: nextId.toString() });

  const amt = parseEther("0.002");
  const dstEid = 40161n; // arbitrary for demo; not used by escrow beyond storage

  const balEscrowBefore = await publicClient.getBalance({ address: tEscrow as `0x${string}` });
  const balProtocolBefore = await publicClient.getBalance({ address: tProtocol as `0x${string}` });

  let hash: `0x${string}` | undefined;
  if(isDryRun){
    logStep('smoke:createOrder:skip', { amt: amt.toString(), dstEid: dstEid.toString() });
  } else {
    logStep('smoke:createOrder:start', { amt: amt.toString(), dstEid: dstEid.toString() });
    hash = await time('smoke:createOrder', () => signer.writeContract({ address: escrowAddr as `0x${string}`, abi: ABI as any, functionName: 'createOrder', args: ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000", amt, 0n, dstEid], value: amt }));
    await publicClient.waitForTransactionReceipt({ hash });
    logStep('smoke:createOrder:confirmed', { tx: hash });
  }

  const balEscrowAfter = await publicClient.getBalance({ address: tEscrow as `0x${string}` });
  const balProtocolAfter = await publicClient.getBalance({ address: tProtocol as `0x${string}` });

  const expectedEscrowFee = (amt * feeEscrow) / 10000n;
  const expectedProtocolFee = (amt * feeProtocol) / 10000n;

  logStep('smoke:fees', { escrowDelta: (balEscrowAfter - balEscrowBefore).toString(), protocolDelta: (balProtocolAfter - balProtocolBefore).toString(), expectedEscrowFee: expectedEscrowFee.toString(), expectedProtocolFee: expectedProtocolFee.toString() });

  const order: any = await publicClient.readContract({ address: escrowAddr as `0x${string}`, abi: ABI as any, functionName: 'getOrder', args: [nextId] });
  logStep('smoke:order', { id: nextId.toString(), maker: order.maker, tokenIn: order.tokenIn, amountIn: order.amountIn.toString(), status: order.status });

  // Negative test: executeFromRemote must be router-only, so this should revert
  try {
    if(!isDryRun){
      await signer.writeContract({ address: escrowAddr as `0x${string}`, abi: ABI as any, functionName: 'executeFromRemote', args: [nextId, me, 0n] });
      console.error("executeFromRemote unexpectedly succeeded (should be Unauthorized)");
    }
  } catch (e: any) {
    logStep('smoke:executeFromRemote:revert', { message: e?.message || String(e) });
  }
  logStep('smoke:complete');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
