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

  // Treasuries must be able to receive ETH for this demo
  const treasuryEscrow = requireEnv("TREASURY_ESCROW");
  const treasuryProtocol = requireEnv("TREASURY_PROTOCOL");

  const EID_A = BigInt(process.env.LOCAL_EID_A || "10001");
  const EID_B = BigInt(process.env.LOCAL_EID_B || "10002");

  // Deploy endpoint
  const Endpoint = await ethers.getContractFactory("MockEndpoint");
  const endpoint = await Endpoint.deploy();
  await endpoint.waitForDeployment();
  const endpointAddr = (endpoint as any).target as string;
  console.log("MockEndpoint:", endpointAddr);

  // Deploy escrows
  const escrowFeeBps = 50n;
  const protocolFeeBps = 20n;
  const Escrow = await ethers.getContractFactory("EscrowCore");
  const escrowA = await Escrow.deploy(
    deployerAddr,
    Number(escrowFeeBps),
    Number(protocolFeeBps),
    treasuryEscrow,
    treasuryProtocol
  );
  await escrowA.waitForDeployment();
  const escrowAAddr = (escrowA as any).target as string;
  console.log("Escrow A:", escrowAAddr);

  const escrowB = await Escrow.deploy(
    deployerAddr,
    Number(escrowFeeBps),
    Number(protocolFeeBps),
    treasuryEscrow,
    treasuryProtocol
  );
  await escrowB.waitForDeployment();
  const escrowBAddr = (escrowB as any).target as string;
  console.log("Escrow B:", escrowBAddr);

  // Deploy routers
  const Router = await ethers.getContractFactory("OAppRouter");
  const routerA = await Router.deploy(endpointAddr, escrowAAddr, deployerAddr, EID_A);
  await routerA.waitForDeployment();
  const routerAAddr = (routerA as any).target as string;
  console.log("Router A:", routerAAddr);

  const routerB = await Router.deploy(endpointAddr, escrowBAddr, deployerAddr, EID_B);
  await routerB.waitForDeployment();
  const routerBAddr = (routerB as any).target as string;
  console.log("Router B:", routerBAddr);

  // Register routers
  await (await endpoint.setRouter(EID_A, routerAAddr)).wait();
  await (await endpoint.setRouter(EID_B, routerBAddr)).wait();

  // Wire peers
  await (await (routerA as any).setPeer(EID_B, ethers.zeroPadValue(routerBAddr, 32))).wait();
  await (await (routerB as any).setPeer(EID_A, ethers.zeroPadValue(routerAAddr, 32))).wait();

  // Point escrows to routers
  await (await (escrowA as any).setRouter(routerAAddr)).wait();
  await (await (escrowB as any).setRouter(routerBAddr)).wait();

  // Demo flow:
  // 1) Create an ETH order on chain B (escrowB). We'll release it to deployer via message from A.
  const nextIdB: bigint = await (escrowB as any).nextOrderId();
  const amountIn = ethers.parseEther("0.3");
  console.log("Creating order on B:", { id: nextIdB.toString(), amountIn: amountIn.toString() });
  await (await (escrowB as any).createOrder(
    ethers.ZeroAddress, // tokenIn: native
    ethers.ZeroAddress, // tokenOut (unused in demo)
    amountIn,
    0, // minOut
    EID_A,
    { value: amountIn }
  )).wait();

  // 2) Send message from router A to B carrying (id, to, minOut)
  const payload = ethers.AbiCoder.defaultAbiCoder().encode([
    "uint256",
    "address",
    "uint256",
  ], [nextIdB, deployerAddr, 0n]);

  const balBefore = await ethers.provider.getBalance(deployerAddr);
  const tx = await (routerA as any).sendSwapMessage(EID_B, payload, { value: 0 });
  const rc = await tx.wait();
  const balAfter = await ethers.provider.getBalance(deployerAddr);

  const ordB = await (escrowB as any).getOrder(nextIdB);
  const netAmount = amountIn - (amountIn * (escrowFeeBps + protocolFeeBps)) / 10000n;

  console.log("Message tx hash:", rc?.hash);
  console.log("Order B status after execute:", ordB.status);
  console.log("Recipient received (approx, gas effects ignored):", (balAfter - balBefore).toString());
  console.log("Expected net (no gas):", netAmount.toString());

  console.log("Demo complete.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
