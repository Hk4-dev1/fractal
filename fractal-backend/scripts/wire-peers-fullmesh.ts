import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { createWalletClient, createPublicClient, http } from "viem";
import { logStep } from './core/log';
import { privateKeyToAccount } from "viem/accounts";

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

async function setPeer(walletClient: ReturnType<typeof createWalletClient>, routerAddr: string, eid: bigint, peerAddr: string) {
  const ABI = [
    { type: 'function', name: 'setPeer', stateMutability: 'nonpayable', inputs: [ { name: 'eid', type: 'uint64' }, { name: 'peer', type: 'bytes32' } ], outputs: [] }
  ];
  const peerBytes32 = `0x${peerAddr.toLowerCase().replace('0x','').padStart(64,'0')}`;
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const hash = await walletClient.writeContract({
        address: routerAddr as `0x${string}`,
        abi: ABI as any,
        functionName: 'setPeer',
        args: [eid, peerBytes32],
        account: walletClient.account!,
        chain: walletClient.chain
      });
      // wait for receipt using a matching public client
      const publicClient = createPublicClient({ chain: walletClient.chain!, transport: http(walletClient.chain!.rpcUrls.default.http[0]) });
      await publicClient.waitForTransactionReceipt({ hash });
      return;
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      const retryable = msg.includes("nonce too low") || msg.includes("nonce has already been used") || msg.includes("replacement transaction underpriced") || msg.includes("timeout") || msg.includes("rate limit") || msg.includes("timeout exceeded");
      if (attempt < maxRetries && retryable) {
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

  logStep('wire-peers:init', { routers: routers.map(r => ({ chainKey: r.chainKey, router: r.router })) });

  // Build providers and signers
  const contexts = routers.map((r) => {
    const account = privateKeyToAccount(pk as `0x${string}`);
    const chain = { id: 0, name: r.chainKey, network: r.chainKey, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [r.rpcUrl] }, public: { http: [r.rpcUrl] } } };
    const walletClient = createWalletClient({ account, chain, transport: http(r.rpcUrl) });
    return { ...r, walletClient };
  });

  // Full mesh: for each A, set peers for all B != A
  for (const a of contexts) {
    for (const b of contexts) {
      if (a.chainKey === b.chainKey) continue;
  logStep('wire-peers:set', { chain: a.chainKey, router: a.router, eid: cfg[b.chainKey].eid, peer: b.router });
  await setPeer(a.walletClient, a.router, BigInt(cfg[b.chainKey].eid), b.router);
      // tiny delay to avoid provider rate limits / nonce races
      await sleep(400);
    }
  }

  logStep('wire-peers:complete');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
