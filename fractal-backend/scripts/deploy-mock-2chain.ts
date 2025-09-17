import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env: ${name}`);
  return v.trim();
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);

  // Fees and treasuries for both escrows (reuse env)
  const escrowFeeBps = 50; // 0.5%
  const protocolFeeBps = 20; // 0.2%
  const treasuryEscrow = requireEnv("TREASURY_ESCROW");
  const treasuryProtocol = requireEnv("TREASURY_PROTOCOL");

  // Local EIDs for two mock chains
  const EID_A = BigInt(process.env.LOCAL_EID_A || "10001");
  const EID_B = BigInt(process.env.LOCAL_EID_B || "10002");

  // Deploy MockEndpoint
  console.log("Deploying MockEndpoint...");
  const Endpoint = await ethers.getContractFactory("MockEndpoint");
  const endpoint = await Endpoint.deploy();
  await endpoint.waitForDeployment();
  const endpointAddr = (endpoint as any).target as string;
  console.log("MockEndpoint:", endpointAddr);

  // Deploy two EscrowCore instances
  const Escrow = await ethers.getContractFactory("EscrowCore");
  const escrowA = await Escrow.deploy(
    deployerAddr,
    escrowFeeBps,
    protocolFeeBps,
    treasuryEscrow,
    treasuryProtocol
  );
  await escrowA.waitForDeployment();
  const escrowAAddr = (escrowA as any).target as string;
  console.log("Escrow A:", escrowAAddr);

  const escrowB = await Escrow.deploy(
    deployerAddr,
    escrowFeeBps,
    protocolFeeBps,
    treasuryEscrow,
    treasuryProtocol
  );
  await escrowB.waitForDeployment();
  const escrowBAddr = (escrowB as any).target as string;
  console.log("Escrow B:", escrowBAddr);

  // Deploy two OAppRouters wired to MockEndpoint
  const Router = await ethers.getContractFactory("OAppRouter");
  const routerA = await Router.deploy(endpointAddr, escrowAAddr, deployerAddr, EID_A);
  await routerA.waitForDeployment();
  const routerAAddr = (routerA as any).target as string;
  console.log("Router A:", routerAAddr);

  const routerB = await Router.deploy(endpointAddr, escrowBAddr, deployerAddr, EID_B);
  await routerB.waitForDeployment();
  const routerBAddr = (routerB as any).target as string;
  console.log("Router B:", routerBAddr);

  // Register routers in endpoint for each EID
  await (await endpoint.setRouter(EID_A, routerAAddr)).wait();
  await (await endpoint.setRouter(EID_B, routerBAddr)).wait();
  console.log("MockEndpoint: routers registered for EIDs", EID_A.toString(), EID_B.toString());

  // Wire peers (each other)
  const peerABytes32 = ethers.zeroPadValue(routerAAddr, 32);
  const peerBBytes32 = ethers.zeroPadValue(routerBAddr, 32);
  await (await (routerA as any).setPeer(EID_B, peerBBytes32)).wait();
  await (await (routerB as any).setPeer(EID_A, peerABytes32)).wait();
  console.log("Peers set:", { A_to_B: peerBBytes32, B_to_A: peerABytes32 });

  // Point escrows to their routers
  await (await (escrowA as any).setRouter(routerAAddr)).wait();
  await (await (escrowB as any).setRouter(routerBAddr)).wait();
  console.log("Escrow routers set.");

  console.log("\nMock 2-chain topology deployed:");
  console.log("Endpoint:", endpointAddr);
  console.log("EIDs:", { EID_A: EID_A.toString(), EID_B: EID_B.toString() });
  console.log("Escrow A:", escrowAAddr);
  console.log("Escrow B:", escrowBAddr);
  console.log("Router A:", routerAAddr);
  console.log("Router B:", routerBAddr);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
