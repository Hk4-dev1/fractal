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

function sleep(ms: number) { return new Promise((res) => setTimeout(res, ms)); }

async function callWithRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 4): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = typeof e?.message === 'string' ? e.message : String(e);
      const code = (e?.code ?? e?.value?.[0]?.code);
      const isRateLimit = msg.includes("Too Many Requests") || code === -32005 || String(code).includes("429");
      const isTransient = isRateLimit || msg.includes("timeout") || msg.includes("missing response") || msg.includes("NETWORK_ERROR") || msg.includes("BAD_DATA");
      if (attempt < maxRetries && isTransient) {
        const backoff = 400 + attempt * 400 + Math.floor(Math.random() * 300);
        // console.warn(`Retry ${label} (attempt ${attempt + 1}/${maxRetries}) after ${backoff}ms: ${msg}`);
        await sleep(backoff);
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

async function main() {
  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

  type Ctx = { chainKey: string; router: string; escrow?: string; provider: ethers.AbstractProvider; eid: number; endpointV2: string };
  const backupRpcs: Record<string, string[]> = {
    "ethereum-sepolia": [
      "https://rpc.sepolia.org"
    ],
    "arbitrum-sepolia": [
      "https://arbitrum-sepolia.blockpi.network/v1/rpc/public",
      "https://sepolia-rollup.arbitrum.io/rpc"
    ],
    "optimism-sepolia": [
      "https://sepolia.optimism.io",
      "https://optimism-sepolia.blockpi.network/v1/rpc/public"
    ],
    "base-sepolia": [
      "https://sepolia.base.org",
      "https://base-sepolia.blockpi.network/v1/rpc/public"
    ]
  };

  const expectedChainId: Record<string, number> = {
    "ethereum-sepolia": 11155111,
    "arbitrum-sepolia": 421614,
    "optimism-sepolia": 11155420,
    "base-sepolia": 84532,
  };

  async function selectProvider(urls: string[], wantChainId?: number): Promise<ethers.AbstractProvider> {
    const cleaned = urls.filter(Boolean);
    for (const u of cleaned) {
      const p = new ethers.JsonRpcProvider(u);
      try {
        const net = await callWithRetry(() => p.getNetwork(), `getNetwork(${new URL(u).hostname})`, 2);
        if (!wantChainId || Number(net.chainId) === Number(wantChainId)) {
          return p;
        }
      } catch (_e) {
        // try next
      }
    }
    // fallback: return first provider; may still succeed for simple calls
    return new ethers.JsonRpcProvider(cleaned[0]);
  }

  // Build contexts asynchronously to allow provider selection
  const ctxPromises = entries.map(async (e): Promise<Ctx | undefined> => {
    const primary = process.env[e.rpcEnv];
    const router = process.env[e.routerEnv];
    const escrow = process.env[e.escrowEnv];
    if (!primary || !router) return undefined; // skip if missing
    const urls = [primary, ...(backupRpcs[e.chainKey] || [])];
    const provider = await selectProvider(urls, expectedChainId[e.chainKey]);
    const eid: number = cfg[e.chainKey]?.eid;
    const endpointV2: string = cfg[e.chainKey]?.endpointV2;
    return { chainKey: e.chainKey, router, escrow, provider, eid, endpointV2 };
  });

  const contexts = (await Promise.all(ctxPromises)).filter((x): x is Ctx => !!x);

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
    const endpoint: string = await callWithRetry(() => router.endpoint(), `[${a.chainKey}] router.endpoint()`);
  console.log(`\n[${a.chainKey}] router=${a.router} expectedEid=${a.eid} endpoint=${endpoint}`);
    if (a.endpointV2 && endpoint.toLowerCase() !== a.endpointV2.toLowerCase()) {
      ok = false;
      console.error(`  MISMATCH endpoint: expected ${a.endpointV2}, got ${endpoint}`);
    }
    if (a.escrow) {
      const escrow = new ethers.Contract(a.escrow, escrowAbi, a.provider);
      const curRouter: string = await callWithRetry(() => escrow.router(), `[${a.chainKey}] escrow.router()`);
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
      const got: string = await callWithRetry(() => router.peers(BigInt(b.eid)), `[${a.chainKey}] router.peers(${b.eid})`);
      if (want.toLowerCase() !== got.toLowerCase()) {
        ok = false;
        console.error(`  MISMATCH peer for eid ${b.eid}: expected ${want}, got ${got}`);
      } else {
        console.log(`  peer[${b.eid}] OK -> ${b.router}`);
      }
      // small pacing to avoid hitting provider rate limits
      await sleep(150);
    }
    await sleep(250);
  }

  if (!ok) {
    throw new Error("Wiring check FAILED");
  }
  console.log("\nWiring check PASSED for all configured chains.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
