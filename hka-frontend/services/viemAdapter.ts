// Unified viem-based utilities to replace common ethers helpers.
// Gradually migrate imports from 'ethers' to this module for read/format & encoding.
import { parseUnits as vParseUnits, formatUnits as vFormatUnits, keccak256, encodePacked, toBytes, concatHex, hexToBytes, bytesToHex } from 'viem';

export const parseUnits = vParseUnits;
export const formatUnits = vFormatUnits;
export { keccak256 };
export { encodePacked };
export { toBytes };
export { concatHex };
export { hexToBytes, bytesToHex };

// Convenience wrapper mirroring legacy naming used in codebase.
export function solidityPacked(types: readonly string[], values: readonly unknown[]) {
  // viem's encodePacked has stricter typing tied to solidity types; our adapter remains permissive on purpose
  return encodePacked(types as unknown as ReadonlyArray<string>, values as ReadonlyArray<unknown>);
}

export function getBytes(hex: string) {
  return hexToBytes(hex as `0x${string}`);
}

export function concat(parts: ReadonlyArray<string | Uint8Array>) {
  // Normalize to hex then back to bytes for simplicity
  const hexes = parts.map(p => typeof p === 'string' ? (p as `0x${string}` | string) : bytesToHex(p as Uint8Array));
  // Ensure 0x prefix for string parts
  const normalized = hexes.map(h => (typeof h === 'string' && !h.startsWith('0x')) ? (bytesToHex(new TextEncoder().encode(h)) as `0x${string}`) : (h as `0x${string}`));
  return hexToBytes(concatHex(normalized));
}

export function hexlify(data: Uint8Array | string) {
  if (typeof data === 'string') return data.startsWith('0x') ? data : bytesToHex(new TextEncoder().encode(data));
  return bytesToHex(data);
}
