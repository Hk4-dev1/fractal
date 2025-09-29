// Fails if any source file (src/services) re-introduces an ethers import.
// This protects the bundle from pulling in the heavy ethers library again.
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = join(dir, d.name)
    if (d.isDirectory()) return walk(p)
    if (/\.(ts|tsx)$/.test(d.name)) return [p]
    return []
  })
}

describe('no ethers import in src/services', () => {
  it('ensures no file imports from ethers', () => {
    const base = join(__dirname, '..')
    const files = walk(base)
    const offenders: string[] = []
    for (const f of files) {
      const txt = readFileSync(f, 'utf8')
  if (/from ['"]ethers['"]/.test(txt) || /require\(['"]ethers['"]\)/.test(txt)) {
        offenders.push(f)
      }
    }
    expect(offenders).toEqual([])
  })
})
