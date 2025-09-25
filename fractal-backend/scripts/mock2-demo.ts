import * as dotenv from "dotenv";
import { viem } from "hardhat";
import { parseEther, encodeAbiParameters } from "viem";
import { logStep } from './core/log';

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env: ${name}`);
  return v.trim();
}

async function main() {
  const [deployer] = await viem.getWalletClients();
  const deployerAddr = deployer.account.address;
  logStep('mock2-demo:init', { deployer: deployerAddr });

  // Treasuries must be able to receive ETH for this demo
  const treasuryEscrow = requireEnv("TREASURY_ESCROW");
  const treasuryProtocol = requireEnv("TREASURY_PROTOCOL");

  const EID_A = BigInt(process.env.LOCAL_EID_A || "10001");
  const EID_B = BigInt(process.env.LOCAL_EID_B || "10002");

  // Deploy endpoint
  const endpoint = await viem.deployContract("MockEndpoint", []);
  const endpointAddr = endpoint.address;
  logStep('mock2-demo:endpoint:deployed', { endpoint: endpointAddr });

  // Deploy escrows
  const escrowFeeBps = 50n;
  const protocolFeeBps = 20n;
  const escrowA = await viem.deployContract("EscrowCore", [
    deployerAddr,
    Number(escrowFeeBps),
    Number(protocolFeeBps),
    treasuryEscrow,
    treasuryProtocol
  ]);
  const escrowAAddr = escrowA.address;
  logStep('mock2-demo:escrowA:deployed', { escrowA: escrowAAddr });

  const escrowB = await viem.deployContract("EscrowCore", [
    deployerAddr,
    Number(escrowFeeBps),
    Number(protocolFeeBps),
    treasuryEscrow,
    treasuryProtocol
  ]);
  const escrowBAddr = escrowB.address;
  logStep('mock2-demo:escrowB:deployed', { escrowB: escrowBAddr });

  // Deploy routers
  const routerA = await viem.deployContract("OAppRouter", [endpointAddr, escrowAAddr, deployerAddr, EID_A]);
  const routerAAddr = routerA.address;
  logStep('mock2-demo:routerA:deployed', { routerA: routerAAddr });

  const routerB = await viem.deployContract("OAppRouter", [endpointAddr, escrowBAddr, deployerAddr, EID_B]);
  const routerBAddr = routerB.address;
  logStep('mock2-demo:routerB:deployed', { routerB: routerBAddr });

  // Register routers
  const MOCK_ENDPOINT_ABI = [{ type: 'function', name: 'setRouter', stateMutability: 'nonpayable', inputs: [{ name: 'eid', type: 'uint64' }, { name: 'router', type: 'address' }], outputs: [] }];
  await deployer.writeContract({ address: endpointAddr as `0x${string}`, abi: MOCK_ENDPOINT_ABI as any, functionName: 'setRouter', args: [EID_A, routerAAddr as `0x${string}`] });
  await deployer.writeContract({ address: endpointAddr as `0x${string}`, abi: MOCK_ENDPOINT_ABI as any, functionName: 'setRouter', args: [EID_B, routerBAddr as `0x${string}`] });

  // Wire peers
  const peerA = `0x${routerAAddr.toLowerCase().replace('0x','').padStart(64,'0')}`;
  const peerB = `0x${routerBAddr.toLowerCase().replace('0x','').padStart(64,'0')}`;
  await deployer.writeContract({ address: routerA.address, abi: routerA.abi, functionName: 'setPeer', args: [EID_B, peerB] });
  await deployer.writeContract({ address: routerB.address, abi: routerB.abi, functionName: 'setPeer', args: [EID_A, peerA] });

  // Point escrows to routers
  const ESCROW_ABI = [{ type: 'function', name: 'setRouter', stateMutability: 'nonpayable', inputs: [{ name: '_router', type: 'address' }], outputs: [] }];
  await deployer.writeContract({ address: escrowAAddr as `0x${string}`, abi: ESCROW_ABI as any, functionName: 'setRouter', args: [routerAAddr as `0x${string}`] });
  await deployer.writeContract({ address: escrowBAddr as `0x${string}`, abi: ESCROW_ABI as any, functionName: 'setRouter', args: [routerBAddr as `0x${string}`] });

  // Demo flow:
  // 1) Create an ETH order on chain B (escrowB). We'll release it to deployer via message from A.
  const nextIdB: bigint = await viem.getPublicClient().then(pc => pc.readContract({ address: escrowB.address, abi: escrowB.abi, functionName: 'nextOrderId' }) as Promise<bigint>);
  const amountIn = parseEther("0.3");
  logStep('mock2-demo:create-order:start', { chain:'B', id: nextIdB.toString(), amountIn: amountIn.toString() });
  // createOrder(tokenIn, tokenOut, amountIn, minAmountOut, dstEid) payable
  await deployer.writeContract({
    address: escrowBAddr as `0x${string}`,
    abi: escrowB.abi,
    functionName: 'createOrder',
    args: ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000", amountIn, 0n, EID_A],
    value: amountIn
  });

  // 2) Send message from router A to B carrying (id, to, minOut)
  // Encode payload (uint256 id, address to, uint256 minOut)
  const payload = encodeAbiParameters([
    { type: 'uint256' },
    { type: 'address' },
    { type: 'uint256' }
  ], [nextIdB, deployerAddr, 0n]);

  // We need public client to get balances
  const publicClient = await viem.getPublicClient();
  const balBefore = await publicClient.getBalance({ address: deployerAddr as `0x${string}` });
  await deployer.writeContract({
    address: routerA.address,
    abi: routerA.abi,
    functionName: 'sendSwapMessage',
    args: [EID_B, payload, '0x'],
    value: 0n
  });
  const balAfter = await publicClient.getBalance({ address: deployerAddr as `0x${string}` });

  const GET_ORDER_ABI = [{ type: 'function', name: 'getOrder', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: '', type: 'tuple', components: [ { name: 'maker', type: 'address' }, { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'minAmountOut', type: 'uint256' }, { name: 'dstEid', type: 'uint64' }, { name: 'createdAt', type: 'uint256' }, { name: 'status', type: 'uint8' } ] }] }];
  const ordB: any = await publicClient.readContract({ address: escrowBAddr as `0x${string}`, abi: GET_ORDER_ABI as any, functionName: 'getOrder', args: [nextIdB] });
  const netAmount = amountIn - (amountIn * (escrowFeeBps + protocolFeeBps)) / 10000n;

  logStep('mock2-demo:order:status', { status: ordB.status });
  logStep('mock2-demo:recipient:received', { received: (balAfter - balBefore).toString(), expectedNet: netAmount.toString() });
  logStep('mock2-demo:complete');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
