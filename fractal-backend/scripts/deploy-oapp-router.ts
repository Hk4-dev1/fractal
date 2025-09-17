import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function optionalEnv(name: string, def?: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : def;
}

function parseCommaList(name: string): string[] | undefined {
  const raw = optionalEnv(name);
  if (!raw) return undefined;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);

  // Required env
  const ESCROW_ADDRESS = requireEnv("ESCROW_ADDRESS");
  // LOCAL_EID can be provided directly or derived from CHAIN_KEY via config
  let localEidStr = optionalEnv("LOCAL_EID");
  const chainKey = optionalEnv("CHAIN_KEY");
  let endpointFromCfg: string | undefined;
  if (chainKey) {
    const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
    const raw = fs.readFileSync(cfgPath, "utf-8");
    const cfg = JSON.parse(raw);
    if (!cfg[chainKey]) throw new Error(`Unknown CHAIN_KEY in config: ${chainKey}`);
    if (!localEidStr) {
      localEidStr = String(cfg[chainKey].eid);
      console.log(`Derived LOCAL_EID=${localEidStr} from CHAIN_KEY=${chainKey}`);
    }
    endpointFromCfg = cfg[chainKey].endpointV2;
  }
  if (!localEidStr) throw new Error("Missing LOCAL_EID (or set CHAIN_KEY to derive)");
  const LOCAL_EID = BigInt(localEidStr);

  // Optional: real endpoint address (LayerZero) — if not provided, deploy MockEndpoint
  const OAPP_ENDPOINT = optionalEnv("OAPP_ENDPOINT");

  // Optional peers setup (comma-separated)
  const PEER_EIDS = parseCommaList("PEER_EIDS");
  const PEER_ADDRESSES = parseCommaList("PEER_ADDRESSES");
  if ((PEER_EIDS && !PEER_ADDRESSES) || (!PEER_EIDS && PEER_ADDRESSES)) {
    throw new Error("Provide both PEER_EIDS and PEER_ADDRESSES, or neither");
  }
  if (PEER_EIDS && PEER_ADDRESSES && PEER_EIDS.length !== PEER_ADDRESSES.length) {
    throw new Error("PEER_EIDS and PEER_ADDRESSES must have the same length");
  }

  let endpointAddr: string;
  if (OAPP_ENDPOINT) {
    endpointAddr = OAPP_ENDPOINT;
    console.log("Using existing endpoint:", endpointAddr);
  } else {
    if (endpointFromCfg) {
      endpointAddr = endpointFromCfg;
      console.log("Using endpointV2 from config:", endpointAddr);
    } else {
      console.log("Deploying MockEndpoint (no OAPP_ENDPOINT set)...");
      const Endpoint = await ethers.getContractFactory("MockEndpoint");
      const endpoint = await Endpoint.deploy();
      await endpoint.waitForDeployment();
      endpointAddr = (endpoint as any).target as string;
      console.log("MockEndpoint:", endpointAddr);
    }
  }

  console.log("Deploying OAppRouter...");
  const Router = await ethers.getContractFactory("OAppRouter");
  const router = await Router.deploy(
    endpointAddr,
    ESCROW_ADDRESS,
    deployerAddr,
    LOCAL_EID
  );
  await router.waitForDeployment();
  const routerAddr = (router as any).target as string;
  console.log("OAppRouter:", routerAddr);

  // If endpoint is MockEndpoint we control, set this router for LOCAL_EID so it can receive
  if (!OAPP_ENDPOINT) {
    const endpoint = await ethers.getContractAt("MockEndpoint", endpointAddr);
    await (await endpoint.setRouter(LOCAL_EID, routerAddr)).wait();
    console.log(`MockEndpoint: setRouter(${LOCAL_EID}) -> ${routerAddr}`);
  }

  // Wire peers (if provided)
  if (PEER_EIDS && PEER_ADDRESSES) {
    console.log("Setting peers...");
    for (let i = 0; i < PEER_EIDS.length; i++) {
      const eid = BigInt(PEER_EIDS[i]);
      const peerAddr = ethers.getAddress(PEER_ADDRESSES[i]);
      const peerBytes32 = ethers.zeroPadValue(peerAddr, 32);
      await (await (router as any).setPeer(eid, peerBytes32)).wait();
      console.log(`Peer set: eid=${eid} -> ${peerAddr} (${peerBytes32})`);
    }
  }

  // Point escrow to this router
  const escrow = await ethers.getContractAt("EscrowCore", ESCROW_ADDRESS);
  await (await (escrow as any).setRouter(routerAddr)).wait();
  console.log("EscrowCore router set ->", routerAddr);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
