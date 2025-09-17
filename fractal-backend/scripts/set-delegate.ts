import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

function ensure(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env ${name}`);
  return v.trim();
}

function toRouterEnv(chainKey: string): string {
  switch (chainKey) {
    case "ethereum-sepolia": return "ROUTERV2_ETH_SEPOLIA";
    case "arbitrum-sepolia": return "ROUTERV2_ARB_SEPOLIA";
    case "optimism-sepolia": return "ROUTERV2_OP_SEPOLIA";
    case "base-sepolia": return "ROUTERV2_BASE_SEPOLIA";
    default: throw new Error(`Unknown CHAIN_KEY: ${chainKey}`);
  }
}

async function main() {
  const chainKey = ensure("CHAIN_KEY");
  const routerEnv = toRouterEnv(chainKey);
  const routerAddr = ensure(routerEnv);
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log(`Setting delegate on ${chainKey} router ${routerAddr} to ${me}`);
  const abi = ["function setDelegate(address _delegate) external"];
  const router = new ethers.Contract(routerAddr, abi, signer);
  const tx = await router.setDelegate(me);
  await tx.wait();
  console.log("Delegate set.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
