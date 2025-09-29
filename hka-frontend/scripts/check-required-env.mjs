#!/usr/bin/env node
// Fail-fast guard for build: ensures at least one RPC source per chain.
// Strategy: either VITE_RPC_* is set OR we rely on baked defaults (public) from CONTRACTS.
// If neither (variable empty and no default rpc in contracts), we abort.
import fs from 'fs'
import path from 'path'
import url from 'url'

const root = path.dirname(url.fileURLToPath(import.meta.url))
const contractsFile = path.join(root, '..', 'services', 'contracts.ts')
const src = fs.readFileSync(contractsFile, 'utf8')

// Parse a minimal map of chainId -> default rpc (regex, not executing TS)
const rpcRegex = /(\d+)\s*:\s*{[^}]*?rpc:\s*'([^']+)'/g
const defaults = new Map()
let m
while ((m = rpcRegex.exec(src))) {
  defaults.set(Number(m[1]), m[2])
}

const CHAINS = [11155111, 421614, 11155420, 84532]
const VARS = {
  11155111: 'VITE_RPC_ETHEREUM_SEPOLIA',
  421614: 'VITE_RPC_ARBITRUM_SEPOLIA',
  11155420: 'VITE_RPC_OPTIMISM_SEPOLIA',
  84532: 'VITE_RPC_BASE_SEPOLIA'
}

const missing = []
for (const id of CHAINS) {
  const v = process.env[VARS[id]]
  const hasVar = v && v.trim().length > 0
  const hasDefault = defaults.get(id)
  if (!hasVar && !hasDefault) {
    missing.push(`${VARS[id]} (no default rpc in contracts.ts)`) }
}

if (missing.length) {
  console.error('\n[env-check] Missing required RPC configuration:')
  for (const x of missing) console.error(' -', x)
  console.error('\nAdd private endpoints or set public defaults before building.')
  process.exit(1)
} else {
  console.log('[env-check] OK: RPC sources satisfied (env or defaults).')
}