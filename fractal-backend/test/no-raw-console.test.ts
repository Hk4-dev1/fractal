import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { expect } from 'chai';

// Guard: discourage scattered console.log in scripts; enforce logStep usage.
// Allowed:
//  - scripts/core/log.ts
//  - test/ files (tests can log freely)
//  - run-e2e-all.js (legacy aggregator)

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, acc); else acc.push(full);
  }
  return acc;
}

describe('No raw console.log in scripts (enforce logStep)', () => {
  it('disallows console.log outside approved files', () => {
    const root = join(__dirname, '..');
    const scriptsDir = join(root, 'scripts');
    const whitelist = new Set([
      join(scriptsDir, 'core', 'log.ts'),
      join(scriptsDir, 'run-e2e-all.js'),
    ].map(p => p.replace(/\\/g,'/')));

    const offenders: { file: string; lines: number[] }[] = [];
    for (const file of collectFiles(scriptsDir)) {
      if (!/\.(ts|js)$/.test(file)) continue;
      const norm = file.replace(/\\/g,'/');
      if (whitelist.has(norm)) continue;
      const src = readFileSync(file, 'utf8');
      const lines = src.split(/\n/);
      const logLines: number[] = [];
      lines.forEach((l,i) => { if (/console\.log\s*\(/.test(l) ) logLines.push(i+1); });
      if (logLines.length) offenders.push({ file: norm, lines: logLines });
    }
    if (offenders.length) {
      console.error('Raw console.log usage found. Use logStep():', offenders);
    }
    expect(offenders, 'Replace console.log with logStep() in scripts (except whitelisted).').to.deep.equal([]);
  });
});
