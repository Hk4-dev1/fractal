import fs from "fs";
import path from "path";
import { logStep } from './core/log';

const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
logStep('chains:list:init');
for (const k of Object.keys(cfg)) {
  logStep('chains:list:item', { chainKey: k });
}
