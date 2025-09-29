import { formatUnits } from '../../services/viemAdapter'
import { withRetries, getViemClient } from './providerCache'
import { parseAbi } from 'viem'

// Minimal Chainlink AggregatorV3Interface
const AGG_ABI = [
  'function latestRoundData() view returns (uint80, int256 answer, uint256, uint256, uint80)',
  'function decimals() view returns (uint8)'
]

// Chainlink ETH/USD on Ethereum Sepolia (canonical fallback across our testnets)
const SEPOLIA_ETH_USD: `0x${string}` = '0x694AA1769357215DE4FAC081bf1f309aDC325306'
// Optional per-chain feeds if verified; otherwise we fallback to Sepolia
const FEEDS: Partial<Record<number, `0x${string}`>> = {
  11155111: SEPOLIA_ETH_USD,
  421614:   '0x1C1aE9bba7ad4bF1D6896c002c7a8DA9cCf74Ce1', // If unstable, we still fallback below
}

export async function getEthUsdPrice(chainId: number): Promise<{ price: string; decimals: number } | null> {
  // Always try Sepolia feed on Sepolia provider first for stability
  try {
    const abi = parseAbi(AGG_ABI)
    const client = getViemClient(11155111)
    const [decRaw, latestRaw] = await withRetries(() => Promise.all([
      client.readContract({ address: SEPOLIA_ETH_USD, abi, functionName: 'decimals' }) as Promise<number | bigint>,
  client.readContract({ address: SEPOLIA_ETH_USD, abi, functionName: 'latestRoundData' }) as Promise<readonly [bigint, bigint, bigint, bigint, bigint]>,
    ]))
    const dec = Number(typeof decRaw === 'bigint' ? Number(decRaw) : decRaw)
    const latest = latestRaw as readonly [bigint, bigint, bigint, bigint, bigint]
    const answer: bigint = latest[1]
    const price = formatUnits(answer, dec)
    return { price, decimals: dec }
  } catch {
    // As a secondary attempt, if we have a known-good feed on the same chain, try it
    try {
      const feed = FEEDS[chainId]
      if (!feed) throw new Error('no per-chain feed')
      const abi = parseAbi(AGG_ABI)
      const client = getViemClient(chainId)
      const [decRaw, latestRaw] = await withRetries(() => Promise.all([
        client.readContract({ address: feed, abi, functionName: 'decimals' }) as Promise<number | bigint>,
        client.readContract({ address: feed, abi, functionName: 'latestRoundData' }) as Promise<readonly [bigint, bigint, bigint, bigint, bigint]>,
      ]))
      const dec = Number(typeof decRaw === 'bigint' ? Number(decRaw) : decRaw)
      const latest = latestRaw as readonly [bigint, bigint, bigint, bigint, bigint]
      const answer: bigint = latest[1]
      const price = formatUnits(answer, dec)
      return { price, decimals: dec }
  } catch {
      return null
    }
  }
}

export async function getEthUsdPriceNumber(chainId: number): Promise<number | null> {
  const res = await getEthUsdPrice(chainId)
  if (!res) return null
  const n = Number(res.price)
  return Number.isFinite(n) ? n : null
}
