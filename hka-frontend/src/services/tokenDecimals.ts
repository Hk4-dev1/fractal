import { getViemClient } from './providerCache'
import { parseAbi, getAddress } from 'viem'
// Minimal chain id -> rpc mapping derived from providers cache (fallback); we reuse getCachedProvider for URL.


// cache key: chainId|address(lower)
const DECIMAL_CACHE = new Map<string, number>()

export async function getTokenDecimals(chainId: number, address: string): Promise<number> {
  if (!address || address === '0x0000000000000000000000000000000000000000') return 18
  const key = `${chainId}|${address.toLowerCase()}`
  const hit = DECIMAL_CACHE.get(key)
  if (hit !== undefined) return hit
  const client = getViemClient(chainId)
  try {
    const dec = await client.readContract({ address: getAddress(address), abi: parseAbi(['function decimals() view returns (uint8)']), functionName: 'decimals' }) as unknown as number | bigint
    const num = typeof dec === 'bigint' ? Number(dec) : dec
    if (Number.isFinite(num) && num > 0 && num < 255) {
      DECIMAL_CACHE.set(key, num)
      return num
    }
  } catch {
    // ignore
  }
  DECIMAL_CACHE.set(key, 18)
  return 18
}

export function primeTokenDecimals(chainId: number, entries: Array<{ address: string; decimals: number }>) {
  for (const e of entries) {
    if (!e.address) continue
    const key = `${chainId}|${e.address.toLowerCase()}`
    if (!DECIMAL_CACHE.has(key)) DECIMAL_CACHE.set(key, e.decimals)
  }
}
