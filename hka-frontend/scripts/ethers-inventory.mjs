#!/usr/bin/env node
// Quick static inventory of ethers usage to plan migration to viem.
// Scans src/, components/, services/ for import patterns and categorizes features.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const roots = ['src', 'components', 'services'];
const projectRoot = process.cwd();

const featureCounts = {
  Provider: 0,
  BrowserProvider: 0,
  JsonRpcProvider: 0,
  Contract: 0,
  Interface: 0,
  AbiCoder: 0,
  parseUnits: 0,
  formatUnits: 0,
  solidityPacked: 0,
  keccak256: 0,
  getBytes: 0,
  hexlify: 0,
  concat: 0,
  toUtf8Bytes: 0,
  Wallet: 0,
  Signer: 0,
  Misc: 0
};

const files = [];
function walk(dir){
  const full = join(projectRoot, dir);
  for (const entry of readdirSync(full)) {
    const p = join(full, entry);
    const rel = p.replace(projectRoot + '/', '');
    const st = statSync(p);
    if (st.isDirectory()) {
      if (/node_modules|dist|coverage/.test(rel)) continue;
      walk(rel);
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
      files.push(rel);
    }
  }
}
roots.forEach(r => walk(r));

const usage = [];
for (const f of files) {
  const text = readFileSync(join(projectRoot, f), 'utf8');
  if (!text.includes("from 'ethers'")) continue;
  const lines = text.split(/\n/);
  lines.forEach((line, i) => {
    if (line.includes("from 'ethers'")) {
      usage.push({ file: f, line: i+1, import: line.trim() });
      Object.keys(featureCounts).forEach(k => {
        if (new RegExp(`\\b${k}\\b`).test(line)) featureCounts[k]++;
      });
    }
    // lightweight heuristic for runtime symbol usage
    if (/parseUnits\(/.test(line)) featureCounts.parseUnits++;
    if (/formatUnits\(/.test(line)) featureCounts.formatUnits++;
    if (/solidityPacked\(/.test(line)) featureCounts.solidityPacked++;
    if (/keccak256\(/.test(line)) featureCounts.keccak256++;
    if (/getBytes\(/.test(line)) featureCounts.getBytes++;
    if (/hexlify\(/.test(line)) featureCounts.hexlify++;
    if (/concat\(/.test(line)) featureCounts.concat++;
    if (/toUtf8Bytes\(/.test(line)) featureCounts.toUtf8Bytes++;
  });
}

console.log('\nethers import sites:');
usage.forEach(u => console.log(`- ${u.file}:${u.line}  ${u.import}`));

console.log('\nFeature usage counts (approx):');
Object.entries(featureCounts).forEach(([k,v]) => {
  if (v>0) console.log(`${k}: ${v}`);
});

// Migration priority suggestion
const priorities = [];
if (featureCounts.parseUnits || featureCounts.formatUnits) priorities.push('Replace parseUnits/formatUnits -> viem (parseUnits, formatUnits)');
if (featureCounts.Contract) priorities.push('Abstract Contract calls via viem publicClient / walletClient');
if (featureCounts.JsonRpcProvider || featureCounts.BrowserProvider) priorities.push('Centralize provider -> viem clients (publicClient, webSocketClient)');
if (featureCounts.AbiCoder || featureCounts.solidityPacked) priorities.push('Use viem encodeAbiParameters / encodePacked');
if (featureCounts.keccak256) priorities.push('Swap to viem keccak256 utility');

console.log('\nMigration priorities:');
priorities.forEach(p => console.log('- ' + p));

console.log('\nDone.');
