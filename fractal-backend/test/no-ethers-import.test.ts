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

describe('No ethers import in backend scripts', () => {
  it('disallows direct ethers imports in scripts/', () => {
    const scriptsDir = path.join(__dirname, '..', 'scripts');
    const files = allFiles(scriptsDir);
    const offenders: string[] = [];
    for (const f of files) {
      const txt = readFileSync(f, 'utf-8');
      if (/from\s+['\"]ethers['\"]/g.test(txt) || /from\s+['\"]hardhat['\"]/g.test(txt) && /ethers\./.test(txt)) {
        offenders.push(path.relative(process.cwd(), f));
      }
    }
    expect(offenders, 'Remove ethers imports from scripts').to.deep.equal([]);
  });
});
