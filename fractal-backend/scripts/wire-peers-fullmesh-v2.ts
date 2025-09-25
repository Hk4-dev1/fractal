import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { createWalletClient, http, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { logStep, time } from './core/log';
import { isDryRun } from './core/flags';

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
  logStep('wire:init', { routers: routers.map(r => `${r.chainKey}:${r.router}`) });

  const ABI = [
    { type: 'function', name: 'setPeer', stateMutability: 'nonpayable', inputs: [ { name: 'eid', type: 'uint64' }, { name: 'peer', type: 'bytes32' } ], outputs: [] },
    { type: 'function', name: 'peers', stateMutability: 'view', inputs: [ { name: '', type: 'uint32' } ], outputs: [ { type: 'bytes32' } ] }
  ];

  for (const a of routers) {
    const account = privateKeyToAccount(pk as `0x${string}`);
    const chain = { id: 0, name: a.chainKey, network: a.chainKey, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [a.rpcUrl] }, public: { http: [a.rpcUrl] } } };
    const walletClient = createWalletClient({ account, chain, transport: http(a.rpcUrl) });
    const publicClient = createPublicClient({ chain, transport: http(a.rpcUrl) });
    for (const b of routers) {
      if (a.chainKey === b.chainKey) continue;
      const peer = `0x${b.router.toLowerCase().replace('0x','').padStart(64,'0')}`;
    logStep('wire:peer:start', { from: a.chainKey, to: b.chainKey });
      let attempts = 0;
      while (true) {
        try {
      if(isDryRun){ logStep('wire:peer:skip', { from: a.chainKey, to: b.chainKey }); break; }
      const hash = await time('setPeer', () => walletClient.writeContract({ address: a.router as `0x${string}`, abi: ABI as any, functionName: 'setPeer', args: [BigInt(b.eid), peer], account: walletClient.account!, chain: walletClient.chain }));
      await publicClient.waitForTransactionReceipt({ hash });
      logStep('wire:peer:confirmed', { from: a.chainKey, to: b.chainKey, tx: hash });
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

  logStep('wire:complete');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
