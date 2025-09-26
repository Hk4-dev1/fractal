import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { expect } from 'chai';

function existsRecursive(dir: string): boolean {
  try {
    const entries = readdirSync(dir);
    return entries.length >= 0;
  } catch {
    return false;
  }
}

describe('guard:no-typechain-types', () => {
  it('typechain-types directory must not exist', () => {
    const dir = join(__dirname, '..', 'typechain-types');
    const present = existsRecursive(dir);
    expect(present, 'typechain-types directory should be absent. Remove legacy ethers/typechain artifacts.').to.eq(false);
  });
});
