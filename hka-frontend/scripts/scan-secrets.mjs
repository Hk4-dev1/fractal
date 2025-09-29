#!/usr/bin/env node
// Simple secret scanner to prevent accidental commits of private keys / API keys.
// Usage: npm run scan:secrets  (exits 1 if suspicious patterns found)

import fs from 'fs'
import path from 'path'

const ROOT = path.join(process.cwd())
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'artifacts', 'cache'])
const ALLOW_FILES = new Set(['.env', '.env.example', '.env.local', '.env.security.example'])

const patterns = [
  {
    id: 'eth-private-key-0x',
    regex: /0x[a-fA-F0-9]{64}\b/,
    msg: 'Possible Ethereum private key (0x + 64 hex)'
  },
  {
    id: 'eth-private-key-raw',
    // PRIVATE_KEY= followed by 64 hex (no 0x)
    regex: /PRIVATE_KEY\s*=\s*["']?([a-fA-F0-9]{64})["']?/,
    msg: 'Raw 64-hex after PRIVATE_KEY='
  },
  {
    id: 'infura-project-id',
    regex: /infura\.io\/v3\/[0-9a-fA-F]{32}\b/,
    msg: 'Embedded Infura project ID URL'
  },
  {
    id: 'alchemy-key',
    // Very loose: alchemy reference with key-like token of 32+ chars
    regex: /alchemy[\w-]*\b.{0,40}?[=:\/]([A-Za-z0-9_-]{28,})/,
    msg: 'Potential Alchemy key/token nearby'
  }
]

/** Recursively gather files */
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const out = []
  for (const e of entries) {
    if (e.name.startsWith('.DS_Store')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue
      out.push(...walk(full))
    } else {
      out.push(full)
    }
  }
  return out
}

const files = walk(ROOT)
let findings = []
for (const f of files) {
  const base = path.basename(f)
  if (ALLOW_FILES.has(base)) continue
  // Skip binary-ish large files (>500KB)
  const stat = fs.statSync(f)
  if (stat.size > 500 * 1024) continue
  const text = fs.readFileSync(f, 'utf8')
  const lines = text.split(/\r?\n/)
  patterns.forEach(p => {
    lines.forEach((line, idx) => {
      if (!p.regex.test(line)) return
      // Heuristic: ignore 0x64hex inside event signature/topic comparisons
      if (p.id === 'eth-private-key-0x' && /topics?\s*\[0\]/i.test(line)) return
      findings.push({ file: f.replace(ROOT + '/', ''), line: idx + 1, pattern: p.id, msg: p.msg, snippet: line.trim().slice(0, 160) })
    })
  })
}

if (findings.length) {
  console.error('\n[scan-secrets] Potential secrets detected:')
  findings.forEach(f => {
    console.error(` - ${f.file}:${f.line} [${f.pattern}] ${f.msg} -> ${f.snippet}`)
  })
  console.error('\nIf these are false positives, adjust scan-secrets.mjs allowlist or patterns.')
  process.exit(1)
} else {
  console.log('[scan-secrets] OK: No obvious secrets found.')
}
