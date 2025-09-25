export type AddressHex = `0x${string}`;

const RE = /^0x[0-9a-fA-F]{40}$/;
export function assertAddress(v: string, label='address'): asserts v is AddressHex {
  if(!RE.test(v)) throw new Error(`Invalid ${label}: ${v}`);
}
export function toAddress(v: string, label='address'): AddressHex {
  assertAddress(v, label); return v as AddressHex;
}
export function ensureAddressFromEnv(name: string): AddressHex {
  const v = process.env[name];
  if(!v) throw new Error(`Missing env ${name}`);
  assertAddress(v, name);
  return v as AddressHex;
}
