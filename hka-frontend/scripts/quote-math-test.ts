#!/usr/bin/env ts-node
import { parseUnits, formatUnits } from 'viem'

interface Case { ethReserve: string; usdcReserve: string; amountInEth: string; feeBps: number }

function simulateEthToUsdc(c: Case) {
  const rEth = parseUnits(c.ethReserve, 18)
  const rUsdc = parseUnits(c.usdcReserve, 6)
  const amountIn = parseUnits(c.amountInEth, 18)
  const feeDen = 10_000n
  const netIn = (amountIn * BigInt(feeDen - BigInt(c.feeBps))) / feeDen
  const k = rEth * rUsdc
  const newEth = rEth + netIn
  const newUsdc = k / newEth
  const out = rUsdc - newUsdc
  const mid = Number(rUsdc) / Number(rEth)
  const exec = Number(out) / Number(netIn)
  const impact = mid > 0 ? ((mid - exec) / mid) * 100 : 0
  return { out, netIn, impact }
}

const cases: Case[] = [
  { ethReserve: '5', usdcReserve: '15000', amountInEth: '0.1', feeBps: 30 },
  { ethReserve: '10', usdcReserve: '30000', amountInEth: '1', feeBps: 30 },
  { ethReserve: '1', usdcReserve: '3000', amountInEth: '0.2', feeBps: 50 },
]

for (const c of cases) {
  const { out, netIn, impact } = simulateEthToUsdc(c)
  console.log(`Reserves ${c.ethReserve} ETH / ${c.usdcReserve} USDC | In ${c.amountInEth} ETH`)
  console.log(`  NetIn(after fee): ${formatUnits(netIn, 18)} ETH  Out: ${formatUnits(out, 6)} USDC  Impact: ${impact.toFixed(3)}%`)  
}
