import { parseUnits, formatUnits } from '../../services/viemAdapter'
import { quoteRoute } from './crosschainRouter'
import CONTRACTS from '../../services/contracts'
import { getTokenDecimals } from './tokenDecimals'
import { getDestinationReserves } from './destinationReserves'

export interface CrossChainSwapQuoteParams {
  fromUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  toUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  fromToken: string
  toToken: string
  amountIn: string // human readable
  user?: `0x${string}`
  subtractFeeBps?: number // protocol + escrow concept
}

export interface CrossChainSwapQuoteResult {
  route: 'direct' | 'multihop'
  amountIn: string
  amountOutEst: string
  priceImpactPercent: number
  nativeFeeEth: string
  lzTokenFeeEth: string
  legs?: Array<{ from: string; to: string; nativeFee: string; lzTokenFee: string }>
}

// Map UI key to chainId via CONTRACTS by reverse lookup of known keys; we rely on crosschainRouter mapping for actual send/fees
const UI_CHAIN_IDS: Record<string, number> = {
  ethereum: 11155111,
  arbitrum: 421614,
  optimism: 11155420,
  base: 84532
}

type ContractsMap = Record<number, { weth: string; testUSDC: string }>

function getTokenAddress(chainId: number, symbol: string): string {
  const c = (CONTRACTS as unknown as ContractsMap)[chainId]
  const s = symbol.toUpperCase()
  if (s === 'ETH' || s === 'WETH') return c.weth
  if (s === 'USDC') return c.testUSDC
  throw new Error(`Unsupported token ${symbol} on chain ${chainId}`)
}

export async function getCrossChainSwapQuote(params: CrossChainSwapQuoteParams): Promise<CrossChainSwapQuoteResult> {
  const { fromUiKey, toUiKey, fromToken, toToken, amountIn, subtractFeeBps = 0 } = params
  const srcChainId = UI_CHAIN_IDS[fromUiKey]
  const dstChainId = UI_CHAIN_IDS[toUiKey]
  if (!srcChainId || !dstChainId) throw new Error('Unsupported chain keys')

  const srcAddr = getTokenAddress(srcChainId, fromToken)
  const dstAddr = getTokenAddress(dstChainId, toToken)
  const srcDecimals = await getTokenDecimals(srcChainId, srcAddr)
  const dstDecimals = await getTokenDecimals(dstChainId, dstAddr)

  let amountInWei = parseUnits(amountIn || '0', srcDecimals)
  if (subtractFeeBps > 0) amountInWei = (amountInWei * BigInt(10_000 - subtractFeeBps)) / 10_000n

  // Fee route (LayerZero) - using existing router logic (works on from chain only for now)
  const feeQuote = await quoteRoute({
    fromUiKey, toUiKey, fromToken, toToken, amount: amountInWei, user: params.user
  })

  // Destination amount estimation using destination reserves constant product.
  // Assumption: bridging delivers the input token or canonical representation then AMM swap happens destination side.
  const dest = await getDestinationReserves(dstChainId)
  const isSrcEthLike = fromToken.toUpperCase() === 'ETH' || fromToken.toUpperCase() === 'WETH'
  const isDstEthLike = toToken.toUpperCase() === 'ETH' || toToken.toUpperCase() === 'WETH'

  let amountOutWei = 0n
  let priceImpactPercent = 0
  const feeDen = 10_000n
  const feeBps = dest.feeBps

  try {
    const amountAfterFee = (amountInWei * (feeDen - feeBps)) / feeDen
    const rEth = dest.ethReserve
    const rUsdc = dest.usdcReserve
    if (isSrcEthLike && !isDstEthLike) {
      // ETH -> USDC on destination
      const k = rEth * rUsdc
      const newEth = rEth + amountAfterFee
      const newUsdc = k / newEth
      amountOutWei = rUsdc - newUsdc
      const mid = Number(rUsdc) / Number(rEth)
      const exec = Number(amountOutWei) / Number(amountAfterFee)
      priceImpactPercent = mid > 0 ? ((mid - exec) / mid) * 100 : 0
    } else if (!isSrcEthLike && isDstEthLike) {
      // USDC -> ETH
      const k = rEth * rUsdc
      const newUsdc = rUsdc + amountAfterFee
      const newEth = k / newUsdc
      amountOutWei = rEth - newEth
      const mid = Number(rEth) / Number(rUsdc) // inverted ratio for USDC->ETH mid price
      const exec = Number(amountOutWei) / Number(amountAfterFee)
      priceImpactPercent = mid > 0 ? ((mid - exec) / mid) * 100 : 0
    } else if (isSrcEthLike && isDstEthLike) {
      // same type bridging (ETH->ETH) - no AMM swap needed
      amountOutWei = amountInWei
      priceImpactPercent = 0
    } else {
      // USDC -> USDC bridging pass-through
      amountOutWei = amountInWei
      priceImpactPercent = 0
    }
  } catch {
    amountOutWei = 0n
  }

  if (amountOutWei < 0n) amountOutWei = 0n
  const amountOutEst = formatUnits(amountOutWei, dstDecimals)

  return {
    route: feeQuote.route,
    amountIn,
    amountOutEst,
    priceImpactPercent,
  nativeFeeEth: (Number(formatUnits(BigInt(feeQuote.nativeFee), 18)).toFixed(6)),
  lzTokenFeeEth: (Number(formatUnits(BigInt(feeQuote.lzTokenFee), 18)).toFixed(6)),
    legs: feeQuote.legs
  }
}
