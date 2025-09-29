import CONTRACTS from '../../services/contracts'
import type { ContractsEntry } from '../../types/contracts'
import { withRetries, getViemClient } from './providerCache'
import { parseAbi } from 'viem'

const AMM_ABI = [
  'function getReserves() view returns (uint256 ethReserve, uint256 usdcReserve)',
  'function feeBps() view returns (uint256)'
]

export interface DestinationReserves {
  ethReserve: bigint
  usdcReserve: bigint
  feeBps: bigint
  fetchedAt: number
}

const CACHE = new Map<string, DestinationReserves>()
const TTL_MS = 5000

export async function getDestinationReserves(chainId: number): Promise<DestinationReserves> {
  const key = String(chainId)
  const hit = CACHE.get(key)
  const now = Date.now()
  if (hit && now - hit.fetchedAt < TTL_MS) return hit
  const contracts = (CONTRACTS as Record<number, Pick<ContractsEntry,'ammEngine'>>)[chainId]
  if (!contracts) throw new Error(`Unsupported dest chain ${chainId}`)
  // Try viem path first
  try {
    const client = getViemClient(chainId)
    const abi = parseAbi(AMM_ABI)
    const [res, feeBpsRaw] = await Promise.all([
      withRetries(() => client.readContract({ address: contracts.ammEngine as `0x${string}`, abi, functionName: 'getReserves' }) as Promise<{ ethReserve: bigint; usdcReserve: bigint } | readonly [bigint, bigint]>),
      client.readContract({ address: contracts.ammEngine as `0x${string}`, abi, functionName: 'feeBps' }).catch(() => 30n) as Promise<bigint | number>
    ])
    const hasStruct = (x: unknown): x is { ethReserve: bigint; usdcReserve: bigint } =>
      typeof x === 'object' && x !== null && 'ethReserve' in x && 'usdcReserve' in x
    const ethReserve: bigint = Array.isArray(res) ? res[0] : (hasStruct(res) ? res.ethReserve : 0n)
    const usdcReserve: bigint = Array.isArray(res) ? res[1] : (hasStruct(res) ? res.usdcReserve : 0n)
    const feeBps = BigInt(feeBpsRaw)
    const out: DestinationReserves = { ethReserve, usdcReserve, feeBps, fetchedAt: now }
    CACHE.set(key, out)
    return out
  } catch { throw new Error('reserves read failed') }
}

export function clearDestinationReserves(chainId?: number) {
  if (chainId === undefined) CACHE.clear(); else CACHE.delete(String(chainId))
}