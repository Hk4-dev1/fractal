import fs from "fs";
import path from "path";

const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
console.log("Available CHAIN_KEY values:");
for (const k of Object.keys(cfg)) {
  console.log("-", k);
}
