import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", await deployer.getAddress());

  const escrowFeeBps = 30; // 0.30% per rules
  const protocolFeeBps = 5; // 0.05% per rules
  const treasuryEscrow = process.env.TREASURY_ESCROW ?? ethers.ZeroAddress;
  const treasuryProtocol = process.env.TREASURY_PROTOCOL ?? ethers.ZeroAddress;
  if (treasuryEscrow === ethers.ZeroAddress || treasuryProtocol === ethers.ZeroAddress) {
    throw new Error("Missing treasuries in env");
  }

  const Escrow = await ethers.getContractFactory("EscrowCore");
  const escrow = await Escrow.deploy(
    await deployer.getAddress(),
    escrowFeeBps,
    protocolFeeBps,
    treasuryEscrow,
    treasuryProtocol
  );
  await escrow.waitForDeployment();
  console.log("EscrowCore:", escrow.target);

  const Router = await ethers.getContractFactory("SimpleRouter");
  const router = await Router.deploy(escrow.target, await deployer.getAddress());
  await router.waitForDeployment();
  console.log("SimpleRouter:", router.target);

  await (await (escrow as any).setRouter(router.target)).wait();
  console.log("Router set on Escrow");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
