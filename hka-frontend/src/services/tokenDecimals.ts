import { Contract, JsonRpcProvider } from 'ethers'
import { getCachedProvider } from './providerCache'

const ERC20_ABI = [ 'function decimals() view returns (uint8)' ]

// cache key: chainId|address(lower)
const DECIMAL_CACHE = new Map<string, number>()

export async function getTokenDecimals(chainId: number, address: string): Promise<number> {
  if (!address || address === '0x0000000000000000000000000000000000000000') return 18
  const key = `${chainId}|${address.toLowerCase()}`
  const hit = DECIMAL_CACHE.get(key)
  if (hit !== undefined) return hit
  const provider: JsonRpcProvider = await getCachedProvider(chainId)
  const erc20 = new Contract(address, ERC20_ABI, provider)
  try {
    const dec: bigint | number = await erc20.decimals()
    const num = typeof dec === 'bigint' ? Number(dec) : dec
    DECIMAL_CACHE.set(key, num)
    return num
  } catch {
    DECIMAL_CACHE.set(key, 18)
    return 18
  }
}

export function primeTokenDecimals(chainId: number, entries: Array<{ address: string; decimals: number }>) {
  for (const e of entries) {
    if (!e.address) continue
    const key = `${chainId}|${e.address.toLowerCase()}`
    if (!DECIMAL_CACHE.has(key)) DECIMAL_CACHE.set(key, e.decimals)
  }
}
