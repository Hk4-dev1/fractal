import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

type Entry = {
  chainKey: string;
  rpcEnv: string;
  routerEnv: string;
  escrowEnv: string;
};

const entries: Entry[] = [
  { chainKey: "ethereum-sepolia", rpcEnv: "ETH_SEPOLIA_RPC_URL", routerEnv: "ROUTERV2_ETH_SEPOLIA", escrowEnv: "ESCROW_ETH_SEPOLIA" },
  { chainKey: "arbitrum-sepolia", rpcEnv: "ARB_SEPOLIA_RPC_URL", routerEnv: "ROUTERV2_ARB_SEPOLIA", escrowEnv: "ESCROW_ARB_SEPOLIA" },
  { chainKey: "optimism-sepolia", rpcEnv: "OP_SEPOLIA_RPC_URL", routerEnv: "ROUTERV2_OP_SEPOLIA", escrowEnv: "ESCROW_OP_SEPOLIA" },
  { chainKey: "base-sepolia", rpcEnv: "BASE_SEPOLIA_RPC_URL", routerEnv: "ROUTERV2_BASE_SEPOLIA", escrowEnv: "ESCROW_BASE_SEPOLIA" },
];

function ensure(val: string | undefined, name: string): string {
  if (!val || val.trim() === "") throw new Error(`Missing env ${name}`);
  return val.trim();
}

async function main() {
  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

  type Ctx = { chainKey: string; router: string; escrow?: string; provider: ethers.JsonRpcProvider; eid: number; endpointV2: string };
  const contexts = entries.map((e): Ctx | undefined => {
    const rpcUrl = process.env[e.rpcEnv];
    const router = process.env[e.routerEnv];
    const escrow = process.env[e.escrowEnv];
  if (!rpcUrl || !router) return undefined; // skip if missing
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const eid: number = cfg[e.chainKey]?.eid;
    const endpointV2: string = cfg[e.chainKey]?.endpointV2;
    return { chainKey: e.chainKey, router, escrow, provider, eid, endpointV2 };
  }).filter((x): x is Ctx => !!x);

  if (contexts.length < 2) throw new Error("Need at least two routers set in env to check wiring");

  const routerAbi = [
  "function peers(uint32) view returns (bytes32)",
    "function endpoint() view returns (address)",
  ];
  const escrowAbi = [
    "function router() view returns (address)",
  ];

  let ok = true;
  for (const a of contexts) {
  const router = new ethers.Contract(a.router, routerAbi, a.provider);
  const endpoint: string = await router.endpoint();
  console.log(`\n[${a.chainKey}] router=${a.router} expectedEid=${a.eid} endpoint=${endpoint}`);
    if (a.endpointV2 && endpoint.toLowerCase() !== a.endpointV2.toLowerCase()) {
      ok = false;
      console.error(`  MISMATCH endpoint: expected ${a.endpointV2}, got ${endpoint}`);
    }
    if (a.escrow) {
      const escrow = new ethers.Contract(a.escrow, escrowAbi, a.provider);
      const curRouter: string = await escrow.router();
      if (curRouter.toLowerCase() !== a.router.toLowerCase()) {
        ok = false;
        console.error(`  MISMATCH escrow.router: expected ${a.router}, got ${curRouter}`);
      } else {
        console.log(`  escrow.router OK -> ${curRouter}`);
      }
    }
    for (const b of contexts) {
      if (a.chainKey === b.chainKey) continue;
      const want = ethers.zeroPadValue(ethers.getAddress(b.router), 32);
      const got: string = await router.peers(BigInt(b.eid));
      if (want.toLowerCase() !== got.toLowerCase()) {
        ok = false;
        console.error(`  MISMATCH peer for eid ${b.eid}: expected ${want}, got ${got}`);
      } else {
        console.log(`  peer[${b.eid}] OK -> ${b.router}`);
      }
    }
  }

  if (!ok) {
    throw new Error("Wiring check FAILED");
  }
  console.log("\nWiring check PASSED for all configured chains.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
