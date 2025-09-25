import * as dotenv from 'dotenv';
import { isAddress, getAddress } from 'viem';

dotenv.config();

export type AddressHex = `0x${string}`;

function missing(name: string): never { throw new Error(`Missing env ${name}`); }
export function raw(name: string): string { const v = process.env[name]; if(!v || v.trim()==='') missing(name); return v.trim(); }

export function optional(name: string): string | undefined { const v = process.env[name]; return v && v.trim()!=='' ? v.trim() : undefined; }

export function addr(name: string): AddressHex {
  const v = raw(name);
  if(!isAddress(v)) throw new Error(`Invalid address in ${name}: ${v}`);
  return getAddress(v) as AddressHex;
}

// Minimal always-required
export const REQUIRED_MIN = ['PRIVATE_KEY'];

export function validateKeys(keys: string[]) {
  const errors: string[] = [];
  for (const k of keys) { try { raw(k); } catch(e:any){ errors.push(e.message); } }
  if(errors.length) {
    throw new Error('Environment validation failed:\n' + errors.map(e=>` - ${e}`).join('\n'));
  }
}

export function requireMinimum(){ validateKeys(REQUIRED_MIN); }
