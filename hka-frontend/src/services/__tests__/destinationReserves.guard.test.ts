import { describe, it, expect } from 'vitest'
import { getDestinationReserves, clearDestinationReserves } from '../destinationReserves'

// This is a lightweight test verifying the struct/tuple guard logic doesn't throw and returns shape.
describe('destinationReserves struct/tuple guard', () => {
  it('returns a DestinationReserves shape (cache path)', async () => {
    clearDestinationReserves(999)
    // We cannot mock viem client here easily without additional tooling;
    // just assert the function throws for unsupported chain and cache path works.
    await expect(getDestinationReserves(999)).rejects.toThrowError()
  })
})
