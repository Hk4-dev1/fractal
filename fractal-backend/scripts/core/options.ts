import { concatHex } from 'viem';

// Build LayerZero Type-3 Executor gas option (plus optional value)
export function buildOptions(gas: bigint = 250_000n, value?: bigint): `0x${string}` {
  const TYPE3=3n, WORKER=1n, OPT=1n;
  const parts: string[] = [gas.toString(16).padStart(32,'0')];
  if(value !== undefined) parts.push(value.toString(16).padStart(32,'0'));
  const opt = `0x${parts.join('')}` as const; // packed uint128 / uint128
  const optLen = (opt.length-2)/2;
  const size = 1 + optLen;
  const header = `0x${TYPE3.toString(16).padStart(4,'0')}` as const;
  const execChunk = (`0x${WORKER.toString(16).padStart(2,'0')}`+`${size.toString(16).padStart(4,'0')}`+`${OPT.toString(16).padStart(2,'0')}`) as `0x${string}`;
  return concatHex([header, execChunk, opt]);
}
