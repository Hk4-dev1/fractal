import { createPublicClient, http, formatEther } from 'viem';
import * as dotenv from 'dotenv';
import { optional } from './core/env';
import { logStep } from './core/log';

dotenv.config();

type Entry = { label: string; rpcEnv: string; escrowEnv: string };
const entries: Entry[] = [
  { label: "ethereum-sepolia", rpcEnv: "ETH_SEPOLIA_RPC_URL", escrowEnv: "ESCROW_ETH_SEPOLIA" },
  { label: "arbitrum-sepolia", rpcEnv: "ARB_SEPOLIA_RPC_URL", escrowEnv: "ESCROW_ARB_SEPOLIA" },
  { label: "optimism-sepolia", rpcEnv: "OP_SEPOLIA_RPC_URL", escrowEnv: "ESCROW_OP_SEPOLIA" },
  { label: "base-sepolia", rpcEnv: "BASE_SEPOLIA_RPC_URL", escrowEnv: "ESCROW_BASE_SEPOLIA" },
];

function fmt(n: bigint) { return formatEther(n); }

async function main() {
  logStep('balances:start');
  for (const e of entries) {
  const rpc = optional(e.rpcEnv);
  const escrow = optional(e.escrowEnv);
    if (!rpc || !escrow) continue;
  const client = createPublicClient({ chain: { id: 0, name: e.label, network: e.label, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] }, public: { http: [rpc] } } }, transport: http(rpc) });
  const bal = await client.getBalance({ address: escrow as `0x${string}` });
  logStep('balance', { chain: e.label, escrow, eth: fmt(bal) });
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
