import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  const addr = process.env.ESCROW_ADDRESS;
  if (!addr) throw new Error("ESCROW_ADDRESS not set");
  const abi = [
    "function owner() view returns (address)",
    "function router() view returns (address)"
  ];
  const escrow = new ethers.Contract(addr, abi, signer);
  const owner = await escrow.owner();
  const router = await escrow.router();
  console.log(JSON.stringify({ me, owner, router }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
