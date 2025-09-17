import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  const escrowAddr = process.env.ESCROW_ADDRESS;
  if (!escrowAddr) throw new Error("ESCROW_ADDRESS not set");

  const targetEscrowBps = BigInt(process.env.NEW_ESCROW_FEE_BPS || "30"); // 0.30%
  const targetProtocolBps = BigInt(process.env.NEW_PROTOCOL_FEE_BPS || "5"); // 0.05%

  const abi = [
    "function setFees(uint256,uint256,address,address) external",
    "function escrowFeeBps() view returns (uint256)",
    "function protocolFeeBps() view returns (uint256)",
    "function treasuryEscrow() view returns (address)",
    "function treasuryProtocol() view returns (address)",
    "function owner() view returns (address)",
  ];
  const escrow = new ethers.Contract(escrowAddr, abi, signer);
  const owner: string = await escrow.owner();
  if (owner.toLowerCase() !== me.toLowerCase()) {
    throw new Error(`Not owner. Owner=${owner}, you=${me}`);
  }

  const curEscrow: bigint = await escrow.escrowFeeBps();
  const curProtocol: bigint = await escrow.protocolFeeBps();
  const tEscrow: string = await escrow.treasuryEscrow();
  const tProtocol: string = await escrow.treasuryProtocol();

  console.log("Current:", { curEscrow: curEscrow.toString(), curProtocol: curProtocol.toString(), tEscrow, tProtocol });
  console.log("Updating to:", { escrowFeeBps: targetEscrowBps.toString(), protocolFeeBps: targetProtocolBps.toString() });

  const tx = await escrow.setFees(Number(targetEscrowBps), Number(targetProtocolBps), tEscrow, tProtocol);
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("Fees updated.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
