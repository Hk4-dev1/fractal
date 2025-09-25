import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { createPublicClient, http } from "viem";
import { getAddress } from "viem";
import { logStep } from './core/log';

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

  type Ctx = { chainKey: string; router: string; escrow?: string; client: ReturnType<typeof createPublicClient>; eid: number; endpointV2: string };
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

  async function selectClient(urls: string[]): Promise<ReturnType<typeof createPublicClient>> {
    const cleaned = urls.filter(Boolean);
    for (const u of cleaned) {
      try {
        const chain = { id: 0, name: 'tmp', network: 'tmp', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [u] }, public: { http: [u] } } } as const;
        const client = createPublicClient({ chain, transport: http(u) });
        // simple call: getBlockNumber
        await callWithRetry(() => client.getBlockNumber(), `getBlockNumber(${new URL(u).hostname})`, 2);
        return client;
      } catch (_e) {
        continue;
      }
    }
    const u = cleaned[0];
    const chain = { id: 0, name: 'fallback', network: 'fallback', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [u] }, public: { http: [u] } } } as const;
    return createPublicClient({ chain, transport: http(u) });
  }

  // Build contexts asynchronously to allow provider selection
  const ctxPromises = entries.map(async (e): Promise<Ctx | undefined> => {
    const primary = process.env[e.rpcEnv];
    const router = process.env[e.routerEnv];
    const escrow = process.env[e.escrowEnv];
    if (!primary || !router) return undefined; // skip if missing
    const urls = [primary, ...(backupRpcs[e.chainKey] || [])];
  const client = await selectClient(urls);
    const eid: number = cfg[e.chainKey]?.eid;
    const endpointV2: string = cfg[e.chainKey]?.endpointV2;
  return { chainKey: e.chainKey, router, escrow, client, eid, endpointV2 };
  });

  const contexts = (await Promise.all(ctxPromises)).filter((x): x is Ctx => !!x);

  if (contexts.length < 2) throw new Error("Need at least two routers set in env to check wiring");

  const ROUTER_ABI = [
    { type: 'function', name: 'peers', stateMutability: 'view', inputs: [{ name: '', type: 'uint32' }], outputs: [{ type: 'bytes32' }] },
    { type: 'function', name: 'endpoint', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }
  ];
  const ESCROW_ABI = [
    { type: 'function', name: 'router', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }
  ];

  let ok = true;
  for (const a of contexts) {
  const endpoint: string = await callWithRetry(() => a.client.readContract({ address: a.router as `0x${string}`, abi: ROUTER_ABI as any, functionName: 'endpoint', args: [] }) as any, `[${a.chainKey}] router.endpoint()`);
  logStep('wiring:router', { chain: a.chainKey, router: a.router, expectedEid: a.eid, endpoint });
    if (a.endpointV2 && endpoint.toLowerCase() !== a.endpointV2.toLowerCase()) {
      ok = false;
      console.error(`  MISMATCH endpoint: expected ${a.endpointV2}, got ${endpoint}`);
    }
    if (a.escrow) {
  const curRouter: string = await callWithRetry(() => a.client.readContract({ address: a.escrow as `0x${string}`, abi: ESCROW_ABI as any, functionName: 'router', args: [] }) as any, `[${a.chainKey}] escrow.router()`);
      if (curRouter.toLowerCase() !== a.router.toLowerCase()) {
        ok = false;
        console.error(`  MISMATCH escrow.router: expected ${a.router}, got ${curRouter}`);
      } else {
  logStep('wiring:escrowRouterOk', { chain: a.chainKey, router: curRouter });
      }
    }
    for (const b of contexts) {
      if (a.chainKey === b.chainKey) continue;
  const want = `0x${getAddress(b.router).toLowerCase().replace('0x','').padStart(64,'0')}`;
  const got: string = await callWithRetry(() => a.client.readContract({ address: a.router as `0x${string}`, abi: ROUTER_ABI as any, functionName: 'peers', args: [BigInt(b.eid)] }) as any, `[${a.chainKey}] router.peers(${b.eid})`);
      if (want.toLowerCase() !== got.toLowerCase()) {
        ok = false;
        console.error(`  MISMATCH peer for eid ${b.eid}: expected ${want}, got ${got}`);
      } else {
  logStep('wiring:peerOk', { from: a.chainKey, toEid: b.eid, toRouter: b.router });
      }
      // small pacing to avoid hitting provider rate limits
      await sleep(150);
    }
    await sleep(250);
  }

  if (!ok) {
    throw new Error("Wiring check FAILED");
  }
  logStep('wiring:complete');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
