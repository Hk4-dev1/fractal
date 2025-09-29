import { parseUnits, formatUnits } from '../../services/viemAdapter'
import CONTRACTS from '../../services/contracts'
import type { ContractsEntry } from '../../types/contracts'
import { getCachedProvider, withRetries, getViemClient } from './providerCache'
import { parseAbi } from 'viem'
import { getDestinationReserves } from './destinationReserves'
import { getTokenDecimals } from './tokenDecimals'

// Extended ABI: try getSwapQuote if exists; always have reserves getters for AMM.sol style
const AMM_ABI = [
  'function getSwapQuote(address,address,uint256) view returns (tuple(uint256 amountIn, uint256 amountOut, uint256 fee, uint256 priceImpact))',
  'function getReserves() view returns (uint256 ethReserve, uint256 usdcReserve)',
  'function feeBps() view returns (uint256)'
]



function getTokenAddressOnChain(chainId: number, symbol: string): string {
  const c = (CONTRACTS as Record<number, ContractsEntry>)[chainId]
  if (!c) throw new Error(`Unsupported chain: ${chainId}`)
  switch ((symbol || '').toUpperCase()) {
    case 'ETH': // map to WETH for AMM
    case 'WETH':
      return c.weth
    case 'USDC':
      return c.testUSDC
    default:
      throw new Error(`Unknown token symbol ${symbol} on chain ${chainId}`)
  }
}

async function resolveDecimals(chainId: number, symbol: string, address: string): Promise<number> {
  if (symbol.toUpperCase() === 'ETH' || symbol.toUpperCase() === 'WETH') return 18
  return await getTokenDecimals(chainId, address)
}

export async function getAmmQuoteOnChain(params: {
  chainId: number
  tokenInSymbol: string
  tokenOutSymbol: string
  amountIn: string
  subtractFeeBps?: number // e.g. escrow+protocol to subtract before AMM
}): Promise<{ amountOut: string; priceImpactPercent: number }> {
  // Lightweight cache keyed by chain/pair/amount bucket
  const cacheKey = (() => {
    const bucketed = (() => {
      const n = Number(params.amountIn || '0')
      // Bucket amounts to 4 decimal places to enable reuse while keeping precision reasonable
      return Math.round(n * 1e4) / 1e4
    })()
    return `${params.chainId}|${params.tokenInSymbol.toUpperCase()}|${params.tokenOutSymbol.toUpperCase()}|${bucketed}|${params.subtractFeeBps ?? 0}`
  })()
  const now = Date.now()
  const globalAny = globalThis as unknown as { __AMM_QUOTE_CACHE__?: Map<string, { ts: number; val: { amountOut: string; priceImpactPercent: number } }> }
  if (!globalAny.__AMM_QUOTE_CACHE__) {
    globalAny.__AMM_QUOTE_CACHE__ = new Map<string, { ts: number; val: { amountOut: string; priceImpactPercent: number } }>()
  }
  const CACHE = globalAny.__AMM_QUOTE_CACHE__ as Map<string, { ts: number; val: { amountOut: string; priceImpactPercent: number } }>
  const ttl = 5000
  const hit = CACHE.get(cacheKey)
  if (hit && now - hit.ts < ttl) return hit.val

  const { chainId, tokenInSymbol, tokenOutSymbol, amountIn, subtractFeeBps = 0 } = params
  getCachedProvider(chainId) // touch cache (latency race) but not directly needed here
  const contracts = (CONTRACTS as Record<number, ContractsEntry>)[chainId]
  const abi = parseAbi(AMM_ABI)
  const viemClient = getViemClient(chainId)

  // Determine token addresses for AMM (convert ETH->WETH for quote)
  const inSym = tokenInSymbol.toUpperCase() === 'ETH' ? 'WETH' : tokenInSymbol
  const outSym = tokenOutSymbol.toUpperCase() === 'ETH' ? 'WETH' : tokenOutSymbol
  const tokenIn = getTokenAddressOnChain(chainId, inSym)
  const tokenOut = getTokenAddressOnChain(chainId, outSym)

  // Parse input using source token decimals
  const inDecimals = await resolveDecimals(chainId, inSym, tokenIn)
  let amountInWei = parseUnits(amountIn, inDecimals)
  if (subtractFeeBps > 0) {
    amountInWei = (amountInWei * BigInt(10000 - subtractFeeBps)) / 10000n
  }

  // Attempt primary path: structured getSwapQuote
  try {
    const qres = await withRetries(async () => {
      return await viemClient.readContract({ address: contracts.ammEngine as `0x${string}`, abi, functionName: 'getSwapQuote', args: [tokenIn as `0x${string}`, tokenOut as `0x${string}`, amountInWei] }) as readonly [bigint, bigint, bigint, bigint]
    })
    // Tuple: (amountIn, amountOut, fee, priceImpact)
    const tuple = qres
    const rawOut = tuple[1]
    const outDecimals = await resolveDecimals(chainId, outSym, tokenOut)
  const amountOut = formatUnits(rawOut, outDecimals)
    const priceImpactBps = Number(tuple[3])
    const priceImpactPercent = priceImpactBps / 10000
    const out = { amountOut, priceImpactPercent }
    CACHE.set(cacheKey, { ts: now, val: out })
    return out
  } catch (e) {
    // Fallback: reserve-based constant product using AMM.sol interface (native ETH + USDC)
    try {
  const dest = await getDestinationReserves(chainId)
  const rEth = dest.ethReserve
  const rUsdc = dest.usdcReserve
  const feeBps = dest.feeBps

      // Identify direction: tokenIn could be WETH or USDC mapping vs AMM which expects native ETH
      const isInEthLike = inSym === 'WETH' || inSym === 'ETH'
      const isOutEthLike = outSym === 'WETH' || outSym === 'ETH'
      const feeDen = 10_000n
      const amountAfterFee = (amountInWei * (feeDen - feeBps)) / feeDen
      let amountOutWei: bigint
      if (isInEthLike && !isOutEthLike) {
        // ETH -> USDC: x=eth, y=usdc
        const newEth = rEth + amountAfterFee
        const k = rEth * rUsdc
        const newUsdc = k / newEth
        amountOutWei = rUsdc - newUsdc
      } else if (!isInEthLike && isOutEthLike) {
        // USDC -> ETH
        const newUsdc = rUsdc + amountAfterFee
        const k = rEth * rUsdc
        const newEth = k / newUsdc
        amountOutWei = rEth - newEth
      } else {
        // Unsupported pair in simple AMM -> return zero to trigger higher-level fallback
        throw new Error('Unsupported direction in fallback AMM')
      }
      if (amountOutWei < 0n) amountOutWei = 0n
  const outDecimals = await resolveDecimals(chainId, outSym, tokenOut)
  const amountOut = formatUnits(amountOutWei, outDecimals)
      // Improved price impact: compare execution price to mid price
      const reserveIn = isInEthLike ? rEth : rUsdc
      const reserveOut = isInEthLike ? rUsdc : rEth
      let priceImpactPercent = 0
      if (reserveIn > 0n && reserveOut > 0n) {
        const midPriceNum = Number(reserveOut) / Number(reserveIn) // y/x
        const execPriceNum = Number(amountOutWei) / Number(amountAfterFee)
        if (midPriceNum > 0 && execPriceNum > 0) {
          priceImpactPercent = ((midPriceNum - execPriceNum) / midPriceNum) * 100
          if (priceImpactPercent < 0) priceImpactPercent = 0
        }
      }
      const out = { amountOut, priceImpactPercent }
      CACHE.set(cacheKey, { ts: now, val: out })
      return out
    } catch {
      // rethrow original getSwapQuote error
      throw e
    }
  }
}
