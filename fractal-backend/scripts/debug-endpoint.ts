import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { createPublicClient, http } from "viem";
import { endpointInspectAbi } from './core/contract';
import { logStep } from './core/log';

dotenv.config();

function ensure(name: string): string { const v = process.env[name]; if (!v || v.trim()==="") throw new Error(`Missing env ${name}`); return v.trim(); }

function rpcEnv(chainKey: string): string {
  switch (chainKey) {
    case "ethereum-sepolia": return "ETH_SEPOLIA_RPC_URL";
    case "arbitrum-sepolia": return "ARB_SEPOLIA_RPC_URL";
    case "optimism-sepolia": return "OP_SEPOLIA_RPC_URL";
    case "base-sepolia": return "BASE_SEPOLIA_RPC_URL";
    default: throw new Error(`Unknown CHAIN_KEY ${chainKey}`);
  }
}
function routerEnv(chainKey: string): string {
  switch (chainKey) {
    case "ethereum-sepolia": return "ROUTERV2_ETH_SEPOLIA";
    case "arbitrum-sepolia": return "ROUTERV2_ARB_SEPOLIA";
    case "optimism-sepolia": return "ROUTERV2_OP_SEPOLIA";
    case "base-sepolia": return "ROUTERV2_BASE_SEPOLIA";
    default: throw new Error(`Unknown CHAIN_KEY ${chainKey}`);
  }
}

function buildChain(id: number, name: string, rpc: string) {
  return {
    id,
    name,
    network: name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] }, public: { http: [rpc] } },
  } as const;
}

function resolveChain(chainKey: string, rpc: string) {
  switch (chainKey) {
    case "ethereum-sepolia": return buildChain(11155111, chainKey, rpc);
    case "arbitrum-sepolia": return buildChain(421614, chainKey, rpc);
    case "optimism-sepolia": return buildChain(11155420, chainKey, rpc);
    case "base-sepolia": return buildChain(84532, chainKey, rpc);
    default: throw new Error(`Unsupported CHAIN_KEY ${chainKey}`);
  }
}

async function main() {
  const chainKey = ensure("CHAIN_KEY");
  const routerAddr = ensure(routerEnv(chainKey));
  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const endpointAddr: string = cfg[chainKey].endpointV2;
  const rpc = ensure(rpcEnv(chainKey));
  const chain = resolveChain(chainKey, rpc);
  const publicClient = createPublicClient({ chain, transport: http(rpc) });

  const abi = endpointInspectAbi;

  const dstEid = Number(process.env.DST_EID || "40243");
  logStep('debug-endpoint:init', { endpoint: endpointAddr, chainKey, dstEid });
  const supported = await publicClient.readContract({ address: endpointAddr as `0x${string}` , abi, functionName: "isSupportedEid", args: [dstEid] });
  const defLib = await publicClient.readContract({ address: endpointAddr as `0x${string}`, abi, functionName: "defaultSendLibrary", args: [dstEid] });
  const rAddr = routerAddr as `0x${string}`; // assume env provides 0x-prefixed
  const appLib = await publicClient.readContract({ address: endpointAddr as `0x${string}`, abi, functionName: "getSendLibrary", args: [rAddr, dstEid] });
  const appUsesDefault = await publicClient.readContract({ address: endpointAddr as `0x${string}`, abi, functionName: "isDefaultSendLibrary", args: [rAddr, dstEid] });
  logStep('debug-endpoint:status', { supported, defaultSendLib: defLib, appLib, appUsesDefault, router: routerAddr });
}

main().catch((e)=>{ console.error(e); process.exitCode = 1; });
