#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
import { ethers } from 'ethers'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const AMM_ABI = [
  'function owner() view returns (address)',
  'function getPool(address,address) view returns (tuple(address token0,address token1,uint256 reserve0,uint256 reserve1,uint256 totalSupply,uint256 lastUpdateTime,bool exists))',
  'function setTokenSupport(address _token, bool _supported)',
  'function createPool(address _token0, address _token1, uint256 _amount0, uint256 _amount1)'
]

const CHAINS = {
  arbitrum: { chainId: 421614, name: 'Arbitrum Sepolia', rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x8422972b99AD56341C36480CCCA687E11A55662F', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43', explorer: 'https://sepolia.arbiscan.io' },
  optimism: { chainId: 11155420, name: 'Optimism Sepolia', rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F', weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa', usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13', explorer: 'https://sepolia-optimism.etherscan.io' },
  base: { chainId: 84532, name: 'Base Sepolia', rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43', explorer: 'https://sepolia.basescan.org' }
}

function sortPair(a, b) { return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a] }

async function main() {
  const iface = new ethers.Interface(AMM_ABI)
  for (const [name, cfg] of Object.entries(CHAINS)) {
    const provider = new ethers.JsonRpcProvider(cfg.rpc)
    const amm = new ethers.Contract(cfg.amm, AMM_ABI, provider)
    const [t0, t1] = sortPair(cfg.weth, cfg.usdc)
    const owner = await amm.owner().catch(() => '0x0000000000000000000000000000000000000000')
    let pool
    try { pool = await amm.getPool(t0, t1) } catch {}
    const exists = !!pool?.exists
    // Suggest default seed sizes: 0.5 WETH, 1500 USDC (decimals-aware)
    const wethDec = 18
    const usdcDec = 6
    const seedWETH = ethers.parseUnits('0.5', wethDec)
    const seedUSDC = ethers.parseUnits('1500', usdcDec)
    const amt0 = t0.toLowerCase() === cfg.weth.toLowerCase() ? seedWETH : seedUSDC
    const amt1 = t1.toLowerCase() === cfg.usdc.toLowerCase() ? seedUSDC : seedWETH
    const data = {
      chain: name,
      chainId: cfg.chainId,
      name: cfg.name,
      explorer: cfg.explorer,
      amm: cfg.amm,
      owner,
      weth: cfg.weth,
      usdc: cfg.usdc,
      token0: t0,
      token1: t1,
      poolExists: exists,
      calldata: {
        setSupportWETH: iface.encodeFunctionData('setTokenSupport', [cfg.weth, true]),
        setSupportUSDC: iface.encodeFunctionData('setTokenSupport', [cfg.usdc, true]),
        createPool: iface.encodeFunctionData('createPool', [t0, t1, amt0, amt1])
      }
    }
    console.log(JSON.stringify(data, null, 2))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
