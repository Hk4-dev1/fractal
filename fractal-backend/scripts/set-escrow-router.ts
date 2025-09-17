import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  const escrowAddr = process.env.ESCROW_ADDRESS;
  const newRouter = process.env.NEW_ROUTER_ADDRESS || "0xd29B640330aBBc0a9D1376eE4327e463c8F16206";
  if (!escrowAddr) throw new Error("ESCROW_ADDRESS not set");
  console.log({ me, escrowAddr, newRouter });
  const abi = ["function setRouter(address _router) external", "function owner() view returns (address)"];
  const escrow = new ethers.Contract(escrowAddr, abi, signer);
  const owner = await escrow.owner();
  console.log({ owner });
  const tx = await escrow.setRouter(newRouter);
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("Router updated.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
