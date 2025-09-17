#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })
import { ethers } from 'ethers'

const ERC20_ABI = [
  'function decimals() view returns (uint8)'
]

const AMM_ABI = [
  'function getSwapQuote(address _tokenIn, address _tokenOut, uint256 _amountIn) view returns (tuple(uint256 amountIn, uint256 amountOut, uint256 fee, uint256 priceImpact))',
]

const CHAINS = {
  ethereum: { chainId: 11155111, rpc: process.env.RPC_ETHEREUM_SEPOLIA || 'https://ethereum-sepolia.publicnode.com', amm: '0x963aED7a6A603edc51F2938af0bdFFadEf28e9bC', weth: '0x0eA0d0923BC5ac5d17DdEc73Af06FaC1a7816927', usdc: '0x787a258717489a07a537d1377A0ee14767BB53c4' },
  arbitrum: { chainId: 421614, rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x8422972b99AD56341C36480CCCA687E11A55662F', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
  optimism: { chainId: 11155420, rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F', weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa', usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13' },
  base: { chainId: 84532, rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
}

async function quote(c) {
  const provider = new ethers.JsonRpcProvider(c.rpc)
  const amm = new ethers.Contract(c.amm, AMM_ABI, provider)
  const usdc = new ethers.Contract(c.usdc, ERC20_ABI, provider)
  const amt = ethers.parseUnits('0.01', 18)
  const res = await amm.getSwapQuote(c.weth, c.usdc, amt)
  const out = res.amountOut ?? res[1]
  const fee = res.fee ?? res[2]
  const impact = res.priceImpact ?? res[3]
  const usdcDec = await usdc.decimals().catch(() => 6)
  return {
    amountOut: Number(ethers.formatUnits(out, usdcDec)),
    fee: Number(ethers.formatEther(fee)),
    priceImpactBps: Number(impact),
  }
}

const results = {}
for (const [name, cfg] of Object.entries(CHAINS)) {
  try {
    results[name] = await quote(cfg)
  } catch (e) {
    results[name] = { error: (e?.shortMessage || e?.message || String(e)) }
  }
}
console.log(JSON.stringify(results, null, 2))
