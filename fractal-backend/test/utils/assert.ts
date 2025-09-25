import { viem } from 'hardhat';
import { expect } from 'chai';
import { decodeEventLog, type Abi } from 'viem';

export async function expectRevert(p: Promise<any>, match: RegExp | string) {
  let failed = false;
  try { await p; } catch (e: any) {
    failed = true;
    const msg = e?.message || '';
    if (match instanceof RegExp) expect(msg).to.match(match); else expect(msg).to.include(match);
  }
  if (!failed) throw new Error('Expected revert not received');
}

export async function findEventLogs<T extends Abi>(hash: `0x${string}`, abi: T, eventName: string) {
  const pc = await viem.getPublicClient();
  const receipt = await pc.getTransactionReceipt({ hash });
  const evs: any[] = [];
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
      if (decoded.eventName === eventName) evs.push(decoded.args);
    } catch {}
  }
  return evs;
}

export async function expectSingleEvent<T extends Abi>(hash: `0x${string}`, abi: T, eventName: string) {
  const evs = await findEventLogs(hash, abi, eventName);
  expect(evs.length, `Expected exactly one ${eventName} event`).to.equal(1);
  return evs[0];
}
