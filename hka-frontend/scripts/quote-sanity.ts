#!/usr/bin/env ts-node
import { formatUnits, parseUnits } from 'ethers'

interface SimParams { inIsEth: boolean; amountIn: string; ethReserve: string; usdcReserve: string; feeBps: number }

function simulate({ inIsEth, amountIn, ethReserve, usdcReserve, feeBps }: SimParams) {
  const rEth = BigInt(ethReserve)
  const rUsdc = BigInt(usdcReserve)
  const feeDen = 10_000n
  const amountInWei = inIsEth ? parseUnits(amountIn, 18) : parseUnits(amountIn, 6)
  const amountAfterFee = (amountInWei * (feeDen - BigInt(feeBps))) / feeDen
  if (inIsEth) {
    const k = rEth * rUsdc
    const newEth = rEth + amountAfterFee
    const newUsdc = k / newEth
    const out = rUsdc - newUsdc
    return { amountOut: formatUnits(out, 6), direction: 'ETH->USDC' }
  } else {
    const k = rEth * rUsdc
    const newUsdc = rUsdc + amountAfterFee
    const newEth = k / newUsdc
    const out = rEth - newEth
    return { amountOut: formatUnits(out, 18), direction: 'USDC->ETH' }
  }
}

const cases: SimParams[] = [
  { inIsEth: true, amountIn: '0.1', ethReserve: parseUnits('5', 18).toString(), usdcReserve: parseUnits('15000', 6).toString(), feeBps: 30 },
  { inIsEth: false, amountIn: '100', ethReserve: parseUnits('5', 18).toString(), usdcReserve: parseUnits('15000', 6).toString(), feeBps: 30 }
]

for (const c of cases) {
  const res = simulate(c)
  console.log(res.direction, 'in', c.amountIn, '=> out', res.amountOut)
}
