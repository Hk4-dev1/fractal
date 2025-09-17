import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

function ensure(name: string): string { const v = process.env[name]; if (!v || v.trim()==="") throw new Error(`Missing env ${name}`); return v.trim(); }

async function main() {
  const chainKey = ensure("CHAIN_KEY");
  const routerEnv = ({
    "ethereum-sepolia":"ROUTERV2_ETH_SEPOLIA",
    "arbitrum-sepolia":"ROUTERV2_ARB_SEPOLIA",
    "optimism-sepolia":"ROUTERV2_OP_SEPOLIA",
    "base-sepolia":"ROUTERV2_BASE_SEPOLIA",
  } as any)[chainKey];
  if (!routerEnv) throw new Error(`Unknown CHAIN_KEY ${chainKey}`);
  const routerAddr = ensure(routerEnv);

  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const entry = cfg[chainKey];
  const endpointAddr: string = entry.endpointV2;
  const rpcEnv = ({
    "ethereum-sepolia":"ETH_SEPOLIA_RPC_URL",
    "arbitrum-sepolia":"ARB_SEPOLIA_RPC_URL",
    "optimism-sepolia":"OP_SEPOLIA_RPC_URL",
    "base-sepolia":"BASE_SEPOLIA_RPC_URL",
  } as any)[chainKey];
  const rpc = ensure(rpcEnv);
  const provider = new ethers.JsonRpcProvider(rpc);

  const abi = [
    "function defaultSendLibrary(uint32) view returns (address)",
    "function getSendLibrary(address,uint32) view returns (address)",
    "function isDefaultSendLibrary(address,uint32) view returns (bool)",
    "function isSupportedEid(uint32) view returns (bool)",
  ];
  const endpoint = new ethers.Contract(endpointAddr, abi, provider);

  const dstEid = BigInt(process.env.DST_EID || "40243");
  console.log(`Endpoint @ ${endpointAddr}, chain ${chainKey}, check dstEid=${dstEid}`);
  const supported = await endpoint.isSupportedEid(dstEid);
  const defLib = await endpoint.defaultSendLibrary(dstEid);
  const appLib = await endpoint.getSendLibrary(routerAddr, dstEid);
  const appUsesDefault = await endpoint.isDefaultSendLibrary(routerAddr, dstEid);
  console.log({ supported, defaultSendLib: defLib, appLib, appUsesDefault, router: routerAddr });
}

main().catch((e)=>{ console.error(e); process.exitCode = 1; });
