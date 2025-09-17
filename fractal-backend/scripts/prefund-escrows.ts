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

function ensure(val: string | undefined, name: string) {
  if (!val || !val.trim()) throw new Error(`Missing env ${name}`);
  return val.trim();
}

async function main() {
  const pk = ensure(process.env.PRIVATE_KEY, "PRIVATE_KEY");
  const amountEth = process.env.PREFUND_AMOUNT_ETH || "0.03"; // default small buffer
  console.log(`Prefund each escrow with ${amountEth} ETH (if needed).`);

  for (const e of entries) {
    const rpc = process.env[e.rpcEnv];
    const escrow = process.env[e.escrowEnv];
    if (!rpc || !escrow) continue;
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);
    const bal = await provider.getBalance(escrow);
    const want = ethers.parseEther(amountEth);
    if (bal >= want) {
      console.log(`- ${e.label}: OK ${ethers.formatEther(bal)} ETH`);
      continue;
    }
    const topup = want - bal;
    console.log(`- ${e.label}: topping up ${ethers.formatEther(topup)} ETH -> ${escrow}`);
    const tx = await wallet.sendTransaction({ to: escrow, value: topup });
    console.log(`  tx: ${tx.hash}`);
    await tx.wait();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
