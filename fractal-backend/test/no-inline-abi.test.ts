import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { expect } from 'chai';

function allFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) allFiles(full, acc); else if (/\.(ts|js)$/.test(entry)) acc.push(full);
  }
  return acc;
}

// Heuristic: flag large inline ABI arrays or parseAbi usage outside core/contract.ts
// Allow small single-function arrays (<=2 entries) to reduce false positives.

describe('No inline ABI duplication in scripts', () => {
  it('discourages large inline ABIs or parseAbi usage outside core/contract.ts', () => {
    const scriptsDir = path.join(__dirname, '..', 'scripts');
    const coreContract = path.join(scriptsDir, 'core', 'contract.ts');
    const files = allFiles(scriptsDir).filter(f => !f.endsWith('.d.ts'));
    const offenders: string[] = [];
    for (const f of files) {
      if (f === coreContract) continue;
      const txt = readFileSync(f, 'utf-8');
      const parseAbiMatches = txt.match(/parseAbi\s*\(\s*\[?([^)]*)\)/);
      let hasParseAbi = false;
      if (parseAbiMatches) {
        const inner = parseAbiMatches[1];
        const funcCount = (inner.match(/function\s+[a-zA-Z0-9_]+\s*\(/g) || []).length;
        if (funcCount > 1) hasParseAbi = true; // allow single function helper usage
      }
      // crude detection of ABI arrays: lines with type:'function' or name:'function' patterns inside array literal
      const abiArrayMatches = txt.match(/\[[^\]]*type:\s*'function'[^\]]*\]/g);
      if (hasParseAbi) offenders.push(path.relative(process.cwd(), f) + ' (parseAbi)');
      if (abiArrayMatches) {
        for (const m of abiArrayMatches) {
          const fnCount = (m.match(/type:\s*'function'/g) || []).length;
          if (fnCount > 2) {
            offenders.push(path.relative(process.cwd(), f) + ` (${fnCount} inline abi funcs)`);
            break;
          }
        }
      }
    }
    expect(offenders, 'Move shared ABIs to scripts/core/contract.ts').to.deep.equal([]);
  });
});
