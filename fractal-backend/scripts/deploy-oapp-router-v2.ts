import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { viem } from "hardhat";
import { getAddress } from "viem";
import { logStep } from './core/log';

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function splitList(name: string): string[] | undefined {
  const raw = optionalEnv(name);
  if (!raw) return undefined;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function escrowEnvForChain(chainKey: string): string | undefined {
  const key = `ESCROW_${chainKey.toUpperCase().replace(/-/g, "_")}`;
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

async function main() {
  const [deployer] = await viem.getWalletClients();
  const deployerAddr = deployer.account.address;
  logStep('deploy-oapp-router-v2:init', { deployer: deployerAddr });

  const chainKey = requireEnv("CHAIN_KEY");
  const ESCROW_ADDRESS = escrowEnvForChain(chainKey) || requireEnv("ESCROW_ADDRESS");

  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const entry = cfg[chainKey];
  if (!entry) throw new Error(`Unknown CHAIN_KEY: ${chainKey}`);
  const endpointV2: string = entry.endpointV2;
  const localEid: number = entry.eid;
  logStep('deploy-oapp-router-v2:endpoint', { endpointV2, localEid });

  logStep('deploy-oapp-router-v2:router:deploying');
  const router = await viem.deployContract("OAppRouterV2", [endpointV2, ESCROW_ADDRESS, deployerAddr]);
  const routerAddr = router.address;
  logStep('deploy-oapp-router-v2:router:deployed', { router: routerAddr });

  // Optional peers via env
  const PEER_EIDS = splitList("PEER_EIDS");
  const PEER_ADDRESSES = splitList("PEER_ADDRESSES");
  if (PEER_EIDS && PEER_ADDRESSES) {
    if (PEER_EIDS.length !== PEER_ADDRESSES.length) throw new Error("PEER_EIDS and PEER_ADDRESSES length mismatch");
  logStep('deploy-oapp-router-v2:peers:start');
    for (let i = 0; i < PEER_EIDS.length; i++) {
  const eid = BigInt(PEER_EIDS[i]);
  const peerAddr = getAddress(PEER_ADDRESSES[i]);
  const peerB32 = `0x${peerAddr.toLowerCase().replace('0x','').padStart(64,'0')}`;
  await deployer.writeContract({ address: router.address, abi: router.abi, functionName: "setPeer", args: [eid, peerB32] });
  logStep('deploy-oapp-router-v2:peers:set', { eid: eid.toString(), peer: peerAddr });
    }
  }

  // Wire escrow to this router
  // Minimal ABI for EscrowCore.setRouter
  const ESCROW_ABI = [{ type: 'function', name: 'setRouter', stateMutability: 'nonpayable', inputs: [{ name: '_router', type: 'address' }], outputs: [] }];
  await deployer.writeContract({ address: ESCROW_ADDRESS as `0x${string}`, abi: ESCROW_ABI as any, functionName: 'setRouter', args: [routerAddr as `0x${string}`] });
  logStep('deploy-oapp-router-v2:escrow:set-router', { router: routerAddr });

  logStep('deploy-oapp-router-v2:complete', { router: routerAddr, endpointV2 });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
