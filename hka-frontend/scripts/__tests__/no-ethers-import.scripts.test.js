// Fails if any frontend script re-introduces `ethers` import.
// Run with your existing test runner (vitest/jest). Adjust pattern if needed.
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')

function gather(dir, out=[]) {
  const full = path.join(ROOT, dir)
  for (const ent of readdirSync(full)) {
    const p = path.join(full, ent)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (ent.startsWith('__tests__')) continue
      gather(path.join(dir, ent), out)
    } else if (/\.(mjs|js|ts)$/.test(ent)) {
      out.push(p)
    }
  }
  return out
}

describe('scripts: no ethers import', () => {
  const files = gather('.')
  it('contains no direct `from \'ethers\'` imports', () => {
    const offenders = []
    for (const f of files) {
      const txt = readFileSync(f, 'utf8')
      if (/from\s+['"]ethers['"]/.test(txt) || /require\(['"]ethers['"]\)/.test(txt)) {
        offenders.push(path.relative(ROOT, f))
      }
    }
    if (offenders.length) {
      throw new Error('Found ethers imports in scripts: ' + offenders.join(', '))
    }
  })
})
