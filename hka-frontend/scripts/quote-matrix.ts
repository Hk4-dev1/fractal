#!/usr/bin/env ts-node
import { getCrossChainSwapQuote } from '../src/services/crosschainSwapQuote'

const chains: Array<'ethereum'|'arbitrum'|'optimism'|'base'> = ['ethereum','arbitrum','optimism','base']

async function main() {
  const amount = '0.05'
  for (const from of chains) {
    for (const to of chains) {
      if (from === to) continue
      try {
        const q = await getCrossChainSwapQuote({ fromUiKey: from, toUiKey: to, fromToken: 'ETH', toToken: 'USDC', amountIn: amount })
        console.log(`${from} -> ${to} | in ${amount} ETH -> est ${q.amountOutEst} USDC | impact=${q.priceImpactPercent.toFixed(3)}% | fee=${q.nativeFeeEth} ETH`)
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message || String(e)
        console.log(`${from} -> ${to} FAILED: ${msg}`)
      }
    }
  }
}

main().catch(e => { 
  console.error(e);
})