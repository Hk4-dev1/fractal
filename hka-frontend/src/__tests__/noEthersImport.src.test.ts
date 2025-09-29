// Fails if any source file under src/ re-introduces an ethers import.
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve, relative } from 'path'
import { describe, it } from 'vitest'

function collect(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (ent === '__tests__') continue
      collect(p, out)
    } else if (/\.(ts|tsx|js|jsx)$/.test(ent)) {
      out.push(p)
    }
  }
  return out
}

describe('no ethers import in src', () => {
  it('ensures no file imports from ethers', () => {
    const ROOT = resolve(__dirname, '..')
    const files = collect(ROOT)
    const offenders: string[] = []
    for (const f of files) {
      const txt = readFileSync(f, 'utf8')
      if (/from\s+['"]ethers['"]/.test(txt) || /require\(['"]ethers['"]\)/.test(txt)) {
        offenders.push(relative(ROOT, f))
      }
    }
    if (offenders.length) {
      throw new Error('Found ethers imports in src files: ' + offenders.join(', '))
    }
  })
})
