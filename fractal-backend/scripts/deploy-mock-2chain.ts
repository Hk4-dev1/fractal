import * as dotenv from "dotenv";
import { viem } from "hardhat";
import { getAddress } from "viem";
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
  logStep('deploy-mock2:init', { deployer: deployerAddr });

  // Fees and treasuries for both escrows (reuse env)
  const escrowFeeBps = 50; // 0.5%
  const protocolFeeBps = 20; // 0.2%
  const treasuryEscrow = requireEnv("TREASURY_ESCROW");
  const treasuryProtocol = requireEnv("TREASURY_PROTOCOL");

  // Local EIDs for two mock chains
  const EID_A = BigInt(process.env.LOCAL_EID_A || "10001");
  const EID_B = BigInt(process.env.LOCAL_EID_B || "10002");

  // Deploy MockEndpoint
  logStep('deploy-mock2:endpoint:deploying');
  const endpoint = await viem.deployContract("MockEndpoint", []);
  const endpointAddr = endpoint.address;
  logStep('deploy-mock2:endpoint:deployed', { endpoint: endpointAddr });

  // Deploy two EscrowCore instances
  const escrowA = await viem.deployContract("EscrowCore", [
    deployerAddr,
    escrowFeeBps,
    protocolFeeBps,
    treasuryEscrow,
    treasuryProtocol
  ]);
  const escrowAAddr = escrowA.address;
  logStep('deploy-mock2:escrowA:deployed', { escrowA: escrowAAddr });

  const escrowB = await viem.deployContract("EscrowCore", [
    deployerAddr,
    escrowFeeBps,
    protocolFeeBps,
    treasuryEscrow,
    treasuryProtocol
  ]);
  const escrowBAddr = escrowB.address;
  logStep('deploy-mock2:escrowB:deployed', { escrowB: escrowBAddr });

  // Deploy two OAppRouters wired to MockEndpoint
  const routerA = await viem.deployContract("OAppRouter", [endpointAddr, escrowAAddr, deployerAddr, EID_A]);
  const routerAAddr = routerA.address;
  logStep('deploy-mock2:routerA:deployed', { routerA: routerAAddr });

  const routerB = await viem.deployContract("OAppRouter", [endpointAddr, escrowBAddr, deployerAddr, EID_B]);
  const routerBAddr = routerB.address;
  logStep('deploy-mock2:routerB:deployed', { routerB: routerBAddr });

  // Register routers in endpoint for each EID
  const MOCK_ENDPOINT_ABI = [{ type: 'function', name: 'setRouter', stateMutability: 'nonpayable', inputs: [{ name: 'eid', type: 'uint64' }, { name: 'router', type: 'address' }], outputs: [] }];
  await deployer.writeContract({ address: endpointAddr as `0x${string}`, abi: MOCK_ENDPOINT_ABI as any, functionName: 'setRouter', args: [EID_A, routerAAddr as `0x${string}`] });
  await deployer.writeContract({ address: endpointAddr as `0x${string}`, abi: MOCK_ENDPOINT_ABI as any, functionName: 'setRouter', args: [EID_B, routerBAddr as `0x${string}`] });
  logStep('deploy-mock2:endpoint:routers-registered', { EID_A: EID_A.toString(), EID_B: EID_B.toString() });

  // Wire peers (each other)
  const peerABytes32 = `0x${routerAAddr.toLowerCase().replace('0x','').padStart(64,'0')}`;
  const peerBBytes32 = `0x${routerBAddr.toLowerCase().replace('0x','').padStart(64,'0')}`;
  await deployer.writeContract({ address: routerA.address, abi: routerA.abi, functionName: 'setPeer', args: [EID_B, peerBBytes32] });
  await deployer.writeContract({ address: routerB.address, abi: routerB.abi, functionName: 'setPeer', args: [EID_A, peerABytes32] });
  logStep('deploy-mock2:peers:set', { A_to_B: peerBBytes32, B_to_A: peerABytes32 });

  // Point escrows to their routers
  const ESCROW_ABI = [{ type: 'function', name: 'setRouter', stateMutability: 'nonpayable', inputs: [{ name: '_router', type: 'address' }], outputs: [] }];
  await deployer.writeContract({ address: escrowAAddr as `0x${string}`, abi: ESCROW_ABI as any, functionName: 'setRouter', args: [routerAAddr as `0x${string}`] });
  await deployer.writeContract({ address: escrowBAddr as `0x${string}`, abi: ESCROW_ABI as any, functionName: 'setRouter', args: [routerBAddr as `0x${string}`] });
  logStep('deploy-mock2:escrows:set-router');

  logStep('deploy-mock2:complete', { endpoint: endpointAddr, EID_A: EID_A.toString(), EID_B: EID_B.toString(), escrowA: escrowAAddr, escrowB: escrowBAddr, routerA: routerAAddr, routerB: routerBAddr });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
