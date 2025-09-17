#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
import { ethers } from 'ethers'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const AMM_ABI = [
  'function FEE_DENOMINATOR() view returns (uint256)',
  'function swapFee() view returns (uint256)',
  'function protocolFee() view returns (uint256)'
]

const CHAINS = {
  ethereum: { chainId: 11155111, rpc: process.env.RPC_ETHEREUM_SEPOLIA || 'https://ethereum-sepolia.publicnode.com', amm: '0x963aED7a6A603edc51F2938af0bdFFadEf28e9bC' },
  arbitrum: { chainId: 421614, rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3' },
  optimism: { chainId: 11155420, rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F' },
  base: { chainId: 84532, rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3' },
}

function toPct(val, denom) {
  if (denom === 0n) return '0%'
  const num = Number(val) / Number(denom) * 100
  return `${num.toFixed(4)}%`
}

async function main() {
  const out = {}
  for (const [name, cfg] of Object.entries(CHAINS)) {
    try {
      const provider = new ethers.JsonRpcProvider(cfg.rpc)
      const amm = new ethers.Contract(cfg.amm, AMM_ABI, provider)
      const denom = await amm.FEE_DENOMINATOR().catch(() => 100000n)
      const swapFee = await amm.swapFee()
      const protocolFee = await amm.protocolFee()
      out[name] = {
        chainId: cfg.chainId,
        amm: cfg.amm,
        FEE_DENOMINATOR: denom.toString(),
        swapFee: swapFee.toString(),
        protocolFee: protocolFee.toString(),
        swapFeePct: toPct(swapFee, denom),
        protocolFeePct: toPct(protocolFee, denom),
        totalAmmPct: toPct(swapFee + protocolFee, denom)
      }
    } catch (e) {
      out[name] = { error: e?.shortMessage || e?.message || String(e) }
    }
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
