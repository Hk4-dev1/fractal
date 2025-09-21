import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import * as crosschainRouter from '../../services/crosschainRouter'
import * as destination from '../../services/destinationReserves'
import * as tokenDec from '../../services/tokenDecimals'
import { getCrossChainSwapQuote } from '../../services/crosschainSwapQuote'

describe('getCrossChainSwapQuote', () => {
  const quoteSpy = vi.spyOn(crosschainRouter, 'quoteRoute')
  const destSpy = vi.spyOn(destination, 'getDestinationReserves')
  const decSpy = vi.spyOn(tokenDec, 'getTokenDecimals')

  type MockQuote = {
    route: 'direct' | 'multihop'
    nativeFee: bigint
    lzTokenFee: bigint
    legs?: Array<{ from: string; to: string; nativeFee: string; lzTokenFee: string }>
  }

  beforeEach(() => {
  const base: MockQuote = {
      route: 'direct',
      nativeFee: 1000000000000000n, // 0.001 ETH
      lzTokenFee: 0n,
      legs: [{ from: 'ethereum', to: 'arbitrum', nativeFee: '0.001', lzTokenFee: '0' }]
  }
  quoteSpy.mockResolvedValue(base as unknown as ReturnType<typeof crosschainRouter.quoteRoute> extends Promise<infer R> ? R : never)
    // 1 ETH = 2000 USDC mid (reserves 1,000 ETH : 2,000,000 USDC)
    destSpy.mockResolvedValue({ ethReserve: 1000n * 10n ** 18n, usdcReserve: 2_000_000n * 10n ** 6n, feeBps: 30n, fetchedAt: Date.now() })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('quotes ETH -> USDC with AMM simulation and LZ fee', async () => {
  decSpy.mockReset()
  // ETH (src) 18, USDC (dst) 6
  decSpy.mockResolvedValueOnce(18)
      .mockResolvedValueOnce(6)
    const res = await getCrossChainSwapQuote({
      fromUiKey: 'ethereum',
      toUiKey: 'arbitrum',
      fromToken: 'ETH',
      toToken: 'USDC',
      amountIn: '1'
    })
    expect(res.route).toBe('direct')
    // AMM output with 0.3% fee on a 1000:2,000,000 pool ~ 1994 USDC
    const approx = Number(res.amountOutEst)
    expect(approx).toBeGreaterThan(1900)
    expect(approx).toBeLessThan(2000)
    // Fee formatted
    expect(res.nativeFeeEth).toBe('0.001000')
  })

  it('quotes USDC -> ETH with AMM simulation and LZ fee', async () => {
  decSpy.mockReset()
  // USDC (src) 6, ETH (dst) 18
  decSpy.mockResolvedValueOnce(6)
      .mockResolvedValueOnce(18)
    const res = await getCrossChainSwapQuote({
      fromUiKey: 'arbitrum',
      toUiKey: 'ethereum',
      fromToken: 'USDC',
      toToken: 'ETH',
      amountIn: '2000'
    })
    expect(res.route).toBe('direct')
    // Should be roughly ~1 ETH minus fee/impact
    const out = Number(res.amountOutEst)
    expect(out).toBeGreaterThan(0.95)
    expect(out).toBeLessThan(1.0)
    expect(res.nativeFeeEth).toBe('0.001000')
  })

  it('handles zero amount gracefully', async () => {
    decSpy.mockReset()
    decSpy.mockResolvedValueOnce(18).mockResolvedValueOnce(6)
    const res = await getCrossChainSwapQuote({
      fromUiKey: 'ethereum',
      toUiKey: 'arbitrum',
      fromToken: 'ETH',
      toToken: 'USDC',
      amountIn: '0'
    })
    expect(Number(res.amountOutEst)).toBe(0)
  })

  it('bridging same token returns pass-through amount', async () => {
    decSpy.mockReset()
    decSpy.mockResolvedValueOnce(18).mockResolvedValueOnce(18)
    const res = await getCrossChainSwapQuote({
      fromUiKey: 'ethereum',
      toUiKey: 'arbitrum',
      fromToken: 'ETH',
      toToken: 'ETH',
      amountIn: '1'
    })
    // No AMM swap, amountOut ~ amountIn
    expect(Number(res.amountOutEst)).toBeCloseTo(1, 10)
  })

  it('large trade shows high price impact', async () => {
    decSpy.mockReset()
    decSpy.mockResolvedValueOnce(18).mockResolvedValueOnce(6)
    const res = await getCrossChainSwapQuote({
      fromUiKey: 'ethereum',
      toUiKey: 'arbitrum',
      fromToken: 'ETH',
      toToken: 'USDC',
      amountIn: '200' // 20% of ETH reserve
    })
    expect(res.priceImpactPercent).toBeGreaterThan(10)
  })

  it('subtractFeeBps reduces output as expected', async () => {
    decSpy.mockReset()
    // two calls -> provide decimals for both invocations (src,dst) x2
    decSpy
      .mockResolvedValueOnce(18).mockResolvedValueOnce(6)
      .mockResolvedValueOnce(18).mockResolvedValueOnce(6)
    const baseline = await getCrossChainSwapQuote({
      fromUiKey: 'ethereum',
      toUiKey: 'arbitrum',
      fromToken: 'ETH',
      toToken: 'USDC',
      amountIn: '1'
    })
    const less = await getCrossChainSwapQuote({
      fromUiKey: 'ethereum',
      toUiKey: 'arbitrum',
      fromToken: 'ETH',
      toToken: 'USDC',
      amountIn: '1',
      subtractFeeBps: 50
    })
    expect(Number(less.amountOutEst)).toBeLessThan(Number(baseline.amountOutEst))
  })

  it('surfaces multihop route and legs', async () => {
    decSpy.mockReset()
    decSpy.mockResolvedValueOnce(18).mockResolvedValueOnce(6)
    // Override to simulate multihop 2 legs
    quoteSpy.mockResolvedValueOnce({
      route: 'multihop',
      nativeFee: (500000000000000n + 600000000000000n) as unknown as bigint,
      lzTokenFee: 0n as unknown as bigint,
      legs: [
        { from: 'arbitrum', to: 'ethereum', nativeFee: '0.0005', lzTokenFee: '0' },
        { from: 'ethereum', to: 'base', nativeFee: '0.0006', lzTokenFee: '0' },
      ],
    } as unknown as ReturnType<typeof crosschainRouter.quoteRoute> extends Promise<infer R> ? R : never)

    const res = await getCrossChainSwapQuote({
      fromUiKey: 'arbitrum',
      toUiKey: 'base',
      fromToken: 'ETH',
      toToken: 'USDC',
      amountIn: '1'
    })
    expect(res.route).toBe('multihop')
    expect(res.legs?.length).toBe(2)
    expect(res.nativeFeeEth).toBe('0.001100')
  })
})
