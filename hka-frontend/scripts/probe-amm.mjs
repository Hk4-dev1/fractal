#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
import { ethers } from 'ethers'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]
const AMM_NATIVE_ABI = [
  'function getReserves() view returns (uint256,uint256)',
  'function addLiquidity(uint256 usdcAmount) payable',
]
const AMM_PAIR_ABI = [
  'function getPool(address,address) view returns (tuple(address token0,address token1,uint256 reserve0,uint256 reserve1,uint256 totalSupply,uint256 lastUpdateTime,bool exists))',
  'function addLiquidity(address,address,uint256,uint256,uint256,uint256) returns (uint256)',
]

const CHAINS = {
  ethereum: { id: 11155111, rpc: process.env.RPC_ETHEREUM_SEPOLIA || 'https://ethereum-sepolia.publicnode.com', amm: '0x963aED7a6A603edc51F2938af0bdFFadEf28e9bC', weth: '0x0eA0d0923BC5ac5d17DdEc73Af06FaC1a7816927', testeth: process.env.VITE_SEPOLIA_TESTETH_ADDRESS, usdc: '0x787a258717489a07a537d1377A0ee14767BB53c4' },
  arbitrum: { id: 421614, rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x8422972b99AD56341C36480CCCA687E11A55662F', testeth: process.env.VITE_ARBITRUM_SEPOLIA_TESTETH_ADDRESS, usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
  optimism: { id: 11155420, rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F', weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa', testeth: process.env.VITE_OPTIMISM_SEPOLIA_TESTETH_ADDRESS, usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13' },
  base: { id: 84532, rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8', testeth: process.env.VITE_BASE_SEPOLIA_TESTETH_ADDRESS, usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
}

function sortPair(a, b) {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]
}

async function classifyAndProbe(name, cfg) {
  const provider = new ethers.JsonRpcProvider(cfg.rpc)
  const code = await provider.getCode(cfg.amm)
  if (!code || code === '0x') return { name, ok: false, reason: 'AMM code not found' }

  const out = { name, chainId: cfg.id, amm: cfg.amm, type: null, details: {} }

  // Try native AMM
  try {
    const ammN = new ethers.Contract(cfg.amm, AMM_NATIVE_ABI, provider)
    const [e, u] = await ammN.getReserves()
    out.type = 'native'
    out.details.reserves = { eth: e.toString(), usdc: u.toString() }
    return out
  } catch {}

  // Try pair AMM
  try {
    const ammP = new ethers.Contract(cfg.amm, AMM_PAIR_ABI, provider)
    const candidates = []
    if (cfg.weth) candidates.push(['WETH', cfg.weth, 'USDC', cfg.usdc])
    if (cfg.testeth) candidates.push(['TestETH', cfg.testeth, 'USDC', cfg.usdc])
    out.type = 'pair'
    out.details.pairs = []
    for (const [an, a, bn, b] of candidates) {
      const [t0, t1] = sortPair(a, b)
      let pool
      try { pool = await ammP.getPool(t0, t1) } catch {}
      out.details.pairs.push({ label: `${an}/${bn}`, token0: t0, token1: t1, exists: !!pool?.exists, pool })
    }
    return out
  } catch {}

  out.type = 'unknown'
  return out
}

const results = {}
for (const [name, cfg] of Object.entries(CHAINS)) {
  // eslint-disable-next-line no-await-in-loop
  results[name] = await classifyAndProbe(name, cfg)
}
const safe = JSON.stringify(results, (key, value) =>
  typeof value === 'bigint' ? value.toString() : value
, 2)
console.log(safe)
