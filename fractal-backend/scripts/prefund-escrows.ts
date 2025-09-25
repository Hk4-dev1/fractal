import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { logStep, time } from './core/log';
import { isDryRun } from './core/flags';

dotenv.config();

const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

type Entry = { label: string; rpcEnv: string; escrowEnv: string };
const entries: Entry[] = [
  { label: "ethereum-sepolia", rpcEnv: "ETH_SEPOLIA_RPC_URL", escrowEnv: "ESCROW_ETH_SEPOLIA" },
  { label: "arbitrum-sepolia", rpcEnv: "ARB_SEPOLIA_RPC_URL", escrowEnv: "ESCROW_ARB_SEPOLIA" },
  { label: "optimism-sepolia", rpcEnv: "OP_SEPOLIA_RPC_URL", escrowEnv: "ESCROW_OP_SEPOLIA" },
  { label: "base-sepolia", rpcEnv: "BASE_SEPOLIA_RPC_URL", escrowEnv: "ESCROW_BASE_SEPOLIA" },
];

function ensure(val: string | undefined, name: string) {
  if (!val || !val.trim()) throw new Error(`Missing env ${name}`);
  return val.trim();
}

async function main() {
  const pk = ensure(process.env.PRIVATE_KEY, "PRIVATE_KEY");
  const amountEth = process.env.PREFUND_AMOUNT_ETH || "0.03"; // default small buffer
  logStep('prefund:init', { amountEth, dryRun: isDryRun });

  for (const e of entries) {
    const rpc = process.env[e.rpcEnv];
    const escrow = process.env[e.escrowEnv];
    if (!rpc || !escrow) continue;
  const account = privateKeyToAccount(pk as `0x${string}`);
  const chain = { id: 0, name: e.label, network: e.label, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] }, public: { http: [rpc] } } };
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
  const bal = await publicClient.getBalance({ address: escrow as `0x${string}` });
  const want = parseEther(amountEth);
  if (bal >= want) { logStep('prefund:skip', { chain: e.label, balance: formatEther(bal) }); continue; }
  const topup = want - bal;
  logStep('prefund:need', { chain: e.label, topup: formatEther(topup) });
  if(isDryRun){ logStep('prefund:dryrun', { chain: e.label }); continue; }
  const hash = await time('prefund:send', () => walletClient.sendTransaction({ chain, to: escrow as `0x${string}`, value: topup }));
  await publicClient.waitForTransactionReceipt({ hash });
  logStep('prefund:confirmed', { chain: e.label, tx: hash });
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
