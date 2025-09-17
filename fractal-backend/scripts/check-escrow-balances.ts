import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

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

function fmt(n: bigint) {
  return ethers.formatEther(n);
}

async function main() {
  console.log("Escrow ETH balances:");
  for (const e of entries) {
    const rpc = process.env[e.rpcEnv];
    const escrow = process.env[e.escrowEnv];
    if (!rpc || !escrow) continue;
    const provider = new ethers.JsonRpcProvider(rpc);
    const bal = await provider.getBalance(escrow);
    console.log(`- ${e.label}: ${escrow} -> ${fmt(bal)} ETH`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
