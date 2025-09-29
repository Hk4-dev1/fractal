// crosschainPayload.ts
// Future-proof encode/decode helpers for cross-chain swap payloads.
// Current on-chain contract may ignore these fields until upgraded.
// Structure (versioned):
// v1: {
//   version: 1,
//   action: 'SWAP',
//   minAmountOut: string (uint256 string),
//   deadline: number (unix seconds),
//   extra?: Record<string, any>
// }
// We serialize to JSON then to bytes (utf8) for simplicity now; can migrate to abi.encode later.

export interface CrosschainSwapPayloadV1 {
  version: 1;
  action: 'SWAP';
  minAmountOut: string; // uint256 as decimal string
  deadline: number; // unix timestamp (secs)
  extra?: Record<string, unknown>;
}

export type AnyCrosschainPayload = CrosschainSwapPayloadV1; // future union

export function buildSwapPayload(params: {
  minAmountOut: string;
  deadline: number;
  extra?: Record<string, unknown>;
}): CrosschainSwapPayloadV1 {
  return {
    version: 1,
    action: 'SWAP',
    minAmountOut: params.minAmountOut,
    deadline: params.deadline,
    extra: params.extra,
  };
}

export function encodePayload(payload: AnyCrosschainPayload): string {
  // For now, return JSON string; caller can convert to bytes via viem stringToHex when sending.
  return JSON.stringify(payload);
}

export function decodePayload(raw: string): AnyCrosschainPayload | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.version === 1 && obj.action === 'SWAP' && typeof obj.minAmountOut === 'string') {
  return obj as CrosschainSwapPayloadV1;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper to compute default deadline (e.g., 10 minutes from now)
export function defaultDeadline(minutesAhead = 10): number {
  return Math.floor(Date.now() / 1000) + minutesAhead * 60;
}

// Placeholder integration note:
// When contracts are updated, replace JSON serialization with ABI encoding like:
// const abi = ["function decode(bytes)"]; // example placeholder
// Keep this file as the single source of truth to avoid drift.
