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

// Forbid any new ethers import / usage now that suite migrated to viem.
// Allow this guard file itself.

describe('No ethers import in tests', () => {
  it('blocks importing ethers or using ethers.* in test/ except migration whitelist', () => {
    const testDir = __dirname;
    const whitelist = new Set<string>([path.join(testDir, 'no-ethers-in-tests.test.ts')]);
    const offenders: string[] = [];
    for (const f of allFiles(testDir)) {
      if (whitelist.has(f)) continue;
      const txt = readFileSync(f, 'utf-8');
      if (/from\s+['\"]ethers['\"]/.test(txt) || /\bethers\./.test(txt)) offenders.push(path.relative(process.cwd(), f));
    }
    expect(offenders, 'Remove ethers from tests (suite is viem-only)').to.deep.equal([]);
  });
});
