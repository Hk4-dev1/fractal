import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function splitList(name: string): string[] | undefined {
  const raw = optionalEnv(name);
  if (!raw) return undefined;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function escrowEnvForChain(chainKey: string): string | undefined {
  const key = `ESCROW_${chainKey.toUpperCase().replace(/-/g, "_")}`;
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);

  const chainKey = requireEnv("CHAIN_KEY");
  const ESCROW_ADDRESS = escrowEnvForChain(chainKey) || requireEnv("ESCROW_ADDRESS");

  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const entry = cfg[chainKey];
  if (!entry) throw new Error(`Unknown CHAIN_KEY: ${chainKey}`);
  const endpointV2: string = entry.endpointV2;
  const localEid: number = entry.eid;
  console.log("Using endpointV2:", endpointV2, "EID:", localEid);

  console.log("Deploying OAppRouterV2...");
  const Router = await ethers.getContractFactory("OAppRouterV2");
  const router = await Router.deploy(endpointV2, ESCROW_ADDRESS, deployerAddr);
  await router.waitForDeployment();
  const routerAddr = (router as any).target as string;
  console.log("OAppRouterV2:", routerAddr);

  // Optional peers via env
  const PEER_EIDS = splitList("PEER_EIDS");
  const PEER_ADDRESSES = splitList("PEER_ADDRESSES");
  if (PEER_EIDS && PEER_ADDRESSES) {
    if (PEER_EIDS.length !== PEER_ADDRESSES.length) throw new Error("PEER_EIDS and PEER_ADDRESSES length mismatch");
    console.log("Setting peers...");
    for (let i = 0; i < PEER_EIDS.length; i++) {
      const eid = BigInt(PEER_EIDS[i]);
      const peerAddr = ethers.getAddress(PEER_ADDRESSES[i]);
      const peerB32 = ethers.zeroPadValue(peerAddr, 32);
      await (await (router as any).setPeer(eid, peerB32)).wait();
      console.log(`  peer[${eid}] = ${peerAddr}`);
    }
  }

  // Wire escrow to this router
  const escrow = await ethers.getContractAt("EscrowCore", ESCROW_ADDRESS);
  await (await (escrow as any).setRouter(routerAddr)).wait();
  console.log("EscrowCore router set ->", routerAddr);

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
