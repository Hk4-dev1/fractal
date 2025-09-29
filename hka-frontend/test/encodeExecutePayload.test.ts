import { describe, it, expect } from 'vitest'
import { encodeAbiParameters } from 'viem'
import { encodeExecutePayload } from '../src/services/crosschainSend'

// Reference implementation (mirrors ethers/viem types) to validate parity
function referenceEncode(id: bigint, to: `0x${string}`, minOut: bigint): `0x${string}` {
  return encodeAbiParameters([
    { type: 'uint256' },
    { type: 'address' },
    { type: 'uint256' }
  ], [id, to, minOut]) as `0x${string}`
}

describe('encodeExecutePayload', () => {
  it('encodes sample values identically to reference', () => {
    const id = 12345678901234567890n
    const to = '0x000000000000000000000000000000000000dEaD'
    const minOut = 0n
    const ref = referenceEncode(id, to, minOut)
    const got = encodeExecutePayload(id, to, minOut)
    expect(got).toBe(ref)
  })

  it('differs when parameters change (sanity)', () => {
    const a = encodeExecutePayload(1n, '0x0000000000000000000000000000000000000001', 0n)
    const b = encodeExecutePayload(2n, '0x0000000000000000000000000000000000000001', 0n)
    expect(a).not.toBe(b)
  })
})
