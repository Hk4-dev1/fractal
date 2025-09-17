import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

const entries = [
  { chainKey: "ethereum-sepolia", routerEnv: "ROUTERV2_ETH_SEPOLIA", rpcEnv: "ETH_SEPOLIA_RPC_URL" },
  { chainKey: "arbitrum-sepolia", routerEnv: "ROUTERV2_ARB_SEPOLIA", rpcEnv: "ARB_SEPOLIA_RPC_URL" },
  { chainKey: "optimism-sepolia", routerEnv: "ROUTERV2_OP_SEPOLIA", rpcEnv: "OP_SEPOLIA_RPC_URL" },
  { chainKey: "base-sepolia", routerEnv: "ROUTERV2_BASE_SEPOLIA", rpcEnv: "BASE_SEPOLIA_RPC_URL" },
];

function ensure(val: string | undefined, name: string): string {
  if (!val || val.trim() === "") throw new Error(`Missing env ${name}`);
  return val.trim();
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const pk = ensure(process.env.PRIVATE_KEY, "PRIVATE_KEY");
  const routers = entries.map((e) => {
    const router = process.env[e.routerEnv];
    const rpcUrl = process.env[e.rpcEnv];
    if (!router || !rpcUrl) return null;
    const { eid } = cfg[e.chainKey];
    return { chainKey: e.chainKey, router, rpcUrl, eid };
  }).filter(Boolean) as Array<{chainKey: string; router: string; rpcUrl: string; eid: number}>;

  if (routers.length < 2) throw new Error("Need at least two v2 routers set");
  console.log("Routers to wire (v2):", routers.map(r => `${r.chainKey}:${r.router}`).join(", "));

  const abi = ["function setPeer(uint64 eid, bytes32 peer) external", "function peers(uint32) view returns (bytes32)"];

  for (const a of routers) {
    const provider = new ethers.JsonRpcProvider(a.rpcUrl);
    const signer = new ethers.Wallet(pk, provider);
    const rA = new ethers.Contract(a.router, abi, signer);
    for (const b of routers) {
      if (a.chainKey === b.chainKey) continue;
      const peer = ethers.zeroPadValue(ethers.getAddress(b.router), 32);
      console.log(`Set peer on ${a.chainKey} -> eid ${b.eid} = ${b.router}`);
      let attempts = 0;
      while (true) {
        try {
          const tx = await rA.setPeer(BigInt(b.eid), peer);
          await tx.wait();
          await sleep(300);
          break;
        } catch (e: any) {
          const msg = (e?.message || "").toLowerCase();
          if (++attempts < 5 && (msg.includes("nonce") || msg.includes("rate limit") || msg.includes("timeout") || msg.includes("underpriced"))) {
            await sleep(1000);
            continue;
          }
          throw e;
        }
      }
    }
  }

  console.log("V2 full-mesh wiring complete.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
