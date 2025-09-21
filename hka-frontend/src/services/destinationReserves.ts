import { Contract } from 'ethers'
import CONTRACTS from '../../services/contracts'
import { getCachedProvider, withRetries } from './providerCache'

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
  const contracts = (CONTRACTS as Record<number, { ammEngine: string }>)[chainId]
  if (!contracts) throw new Error(`Unsupported dest chain ${chainId}`)
  const provider = getCachedProvider(chainId)
  const amm = new Contract(contracts.ammEngine, AMM_ABI, provider)
  const [res, feeBps] = await Promise.all([
    withRetries(() => amm.getReserves()),
    amm.feeBps().catch(() => 30n)
  ])
  const ethReserve: bigint = res.ethReserve || res[0]
  const usdcReserve: bigint = res.usdcReserve || res[1]
  const out: DestinationReserves = { ethReserve, usdcReserve, feeBps: BigInt(feeBps), fetchedAt: now }
  CACHE.set(key, out)
  return out
}

export function clearDestinationReserves(chainId?: number) {
  if (chainId === undefined) CACHE.clear(); else CACHE.delete(String(chainId))
}