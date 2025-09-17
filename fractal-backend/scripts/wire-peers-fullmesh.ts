import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

const entries: Array<{chainKey: string; routerEnv: string; rpcEnv: string}> = [
  { chainKey: "ethereum-sepolia", routerEnv: "ROUTER_ETH_SEPOLIA", rpcEnv: "ETH_SEPOLIA_RPC_URL" },
  { chainKey: "arbitrum-sepolia", routerEnv: "ROUTER_ARB_SEPOLIA", rpcEnv: "ARB_SEPOLIA_RPC_URL" },
  { chainKey: "optimism-sepolia", routerEnv: "ROUTER_OP_SEPOLIA", rpcEnv: "OP_SEPOLIA_RPC_URL" },
  { chainKey: "base-sepolia", routerEnv: "ROUTER_BASE_SEPOLIA", rpcEnv: "BASE_SEPOLIA_RPC_URL" },
];

function ensure(val: string | undefined, name: string): string {
  if (!val || val.trim() === "") throw new Error(`Missing env ${name}`);
  return val.trim();
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function setPeer(provider: ethers.JsonRpcProvider, signer: ethers.Wallet, routerAddr: string, eid: bigint, peerAddr: string) {
  const abi = [
    "function setPeer(uint64 eid, bytes32 peer) external",
  ];
  const router = new ethers.Contract(routerAddr, abi, signer.connect(provider));
  const peerBytes32 = ethers.zeroPadValue(ethers.getAddress(peerAddr), 32);
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tx = await router.setPeer(eid, peerBytes32);
      await tx.wait();
      return;
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      const retryable = msg.includes("nonce too low") || msg.includes("nonce has already been used") || msg.includes("replacement transaction underpriced") || msg.includes("timeout") || msg.includes("rate limit") || msg.includes("timeout exceeded");
      if (attempt < maxRetries && retryable) {
        // small backoff then retry
        await sleep(1500 * attempt);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  const pk = ensure(process.env.PRIVATE_KEY, "PRIVATE_KEY");

  // Collect live routers
  const routers = entries
    .map((e) => {
      const info = cfg[e.chainKey];
      if (!info) throw new Error(`Missing config for ${e.chainKey}`);
      const eid: bigint = BigInt(info.eid);
      const endpointV2: string = info.endpointV2;
      const routerAddr = process.env[e.routerEnv];
      const rpcUrl = process.env[e.rpcEnv];
      if (!routerAddr || !rpcUrl) return null; // skip if not filled
      return { chainKey: e.chainKey, eid, endpointV2, router: routerAddr, rpcUrl };
    })
    .filter((x): x is {chainKey: string; eid: bigint; endpointV2: string; router: string; rpcUrl: string} => !!x);

  if (routers.length < 2) {
    throw new Error("Need at least two routers deployed and set in env to wire peers.");
  }

  console.log("Routers to wire:", routers.map(r => `${r.chainKey}:${r.router}`).join(", "));

  // Build providers and signers
  const contexts = routers.map((r) => {
    const provider = new ethers.JsonRpcProvider(r.rpcUrl);
    const wallet = new ethers.Wallet(pk, provider);
    return { ...r, provider, wallet };
  });

  // Full mesh: for each A, set peers for all B != A
  for (const a of contexts) {
    for (const b of contexts) {
      if (a.chainKey === b.chainKey) continue;
      console.log(`Setting peer on ${a.chainKey} router ${a.router} for eid ${cfg[b.chainKey].eid} -> ${b.router}`);
      await setPeer(a.provider, a.wallet, a.router, BigInt(cfg[b.chainKey].eid), b.router);
      // tiny delay to avoid provider rate limits / nonce races
      await sleep(400);
    }
  }

  console.log("Full-mesh peer wiring complete.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
