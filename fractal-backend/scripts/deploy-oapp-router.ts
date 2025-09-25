import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { viem } from "hardhat";
import { getAddress, zeroAddress } from "viem";
import { logStep } from './core/log';

// Minimal ABIs needed
const MOCK_ENDPOINT_ABI = [
  { "type": "function", "name": "setRouter", "stateMutability": "nonpayable", "inputs": [ { "name": "eid", "type": "uint64" }, { "name": "router", "type": "address" } ], "outputs": [] }
];
const ESCROW_CORE_ABI = [
  { "type": "function", "name": "setRouter", "stateMutability": "nonpayable", "inputs": [ { "name": "_router", "type": "address" } ], "outputs": [] }
];

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function optionalEnv(name: string, def?: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : def;
}

function parseCommaList(name: string): string[] | undefined {
  const raw = optionalEnv(name);
  if (!raw) return undefined;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const [deployer] = await viem.getWalletClients();
  const deployerAddr = deployer.account.address;
  logStep('deploy-oapp-router:init', { deployer: deployerAddr });

  // Required env
  const ESCROW_ADDRESS = requireEnv("ESCROW_ADDRESS");
  // LOCAL_EID can be provided directly or derived from CHAIN_KEY via config
  let localEidStr = optionalEnv("LOCAL_EID");
  const chainKey = optionalEnv("CHAIN_KEY");
  let endpointFromCfg: string | undefined;
  if (chainKey) {
    const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
    const raw = fs.readFileSync(cfgPath, "utf-8");
    const cfg = JSON.parse(raw);
    if (!cfg[chainKey]) throw new Error(`Unknown CHAIN_KEY in config: ${chainKey}`);
    if (!localEidStr) {
      localEidStr = String(cfg[chainKey].eid);
  logStep('deploy-oapp-router:derived-local-eid', { chainKey, localEid: localEidStr });
    }
    endpointFromCfg = cfg[chainKey].endpointV2;
  }
  if (!localEidStr) throw new Error("Missing LOCAL_EID (or set CHAIN_KEY to derive)");
  const LOCAL_EID = BigInt(localEidStr);

  // Optional: real endpoint address (LayerZero) — if not provided, deploy MockEndpoint
  const OAPP_ENDPOINT = optionalEnv("OAPP_ENDPOINT");

  // Optional peers setup (comma-separated)
  const PEER_EIDS = parseCommaList("PEER_EIDS");
  const PEER_ADDRESSES = parseCommaList("PEER_ADDRESSES");
  if ((PEER_EIDS && !PEER_ADDRESSES) || (!PEER_EIDS && PEER_ADDRESSES)) {
    throw new Error("Provide both PEER_EIDS and PEER_ADDRESSES, or neither");
  }
  if (PEER_EIDS && PEER_ADDRESSES && PEER_EIDS.length !== PEER_ADDRESSES.length) {
    throw new Error("PEER_EIDS and PEER_ADDRESSES must have the same length");
  }

  let endpointAddr: string;
  if (OAPP_ENDPOINT) {
    endpointAddr = OAPP_ENDPOINT;
  logStep('deploy-oapp-router:endpoint:existing', { endpoint: endpointAddr });
  } else {
    if (endpointFromCfg) {
      endpointAddr = endpointFromCfg;
  logStep('deploy-oapp-router:endpoint:config', { endpoint: endpointAddr, chainKey });
    } else {
  logStep('deploy-oapp-router:endpoint:mock:deploying');
  const endpoint = await viem.deployContract("MockEndpoint", []);
  endpointAddr = endpoint.address;
  logStep('deploy-oapp-router:endpoint:mock:deployed', { endpoint: endpointAddr });
    }
  }

  logStep('deploy-oapp-router:router:deploying');
  const router = await viem.deployContract("OAppRouter", [
    endpointAddr,
    ESCROW_ADDRESS,
    deployerAddr,
    LOCAL_EID
  ]);
  const routerAddr = router.address;
  logStep('deploy-oapp-router:router:deployed', { router: routerAddr });

  // If endpoint is MockEndpoint we control, set this router for LOCAL_EID so it can receive
  if (!OAPP_ENDPOINT) {
    await deployer.writeContract({
      address: endpointAddr as `0x${string}`,
      abi: MOCK_ENDPOINT_ABI as any,
      functionName: "setRouter",
      args: [LOCAL_EID, routerAddr as `0x${string}`]
    });
  logStep('deploy-oapp-router:endpoint:set-router', { localEid: LOCAL_EID.toString(), router: routerAddr });
  }

  // Wire peers (if provided)
  if (PEER_EIDS && PEER_ADDRESSES) {
  logStep('deploy-oapp-router:peers:start');
    for (let i = 0; i < PEER_EIDS.length; i++) {
      const eid = BigInt(PEER_EIDS[i]);
      const peerAddr = getAddress(PEER_ADDRESSES[i]);
      const peerBytes32 = peerAddr.toLowerCase().replace('0x','').padStart(64,'0');
      await deployer.writeContract({
        address: router.address,
        abi: router.abi,
        functionName: "setPeer",
        args: [eid, `0x${peerBytes32}`]
      });
  logStep('deploy-oapp-router:peers:set', { eid: eid.toString(), peer: peerAddr });
    }
  }

  // Point escrow to this router
  await deployer.writeContract({
    address: ESCROW_ADDRESS as `0x${string}`,
    abi: ESCROW_CORE_ABI as any,
    functionName: "setRouter",
    args: [routerAddr as `0x${string}`]
  });
  logStep('deploy-oapp-router:escrow:set-router', { router: routerAddr });

  logStep('deploy-oapp-router:complete', { router: routerAddr, endpoint: endpointAddr });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
