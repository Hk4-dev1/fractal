import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const chainKey = process.env.CHAIN_KEY || "";
if (!chainKey) {
  console.error("Set CHAIN_KEY env first (ethereum-sepolia | arbitrum-sepolia | optimism-sepolia | base-sepolia)");
  process.exit(1);
}

const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
const c = cfg[chainKey];
if (!c) {
  console.error(`Unknown CHAIN_KEY: ${chainKey}`);
  process.exit(1);
}

console.log(JSON.stringify({ chainKey, ...c }, null, 2));
