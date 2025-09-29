#!/usr/bin/env node
// Migrated from ethers -> viem
import dotenv from 'dotenv'
import path from 'path'
import { createPublicClient, http, encodeFunctionData, parseUnits } from 'viem'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const AMM_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'getPool', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'address', name: 'token0' }, { type: 'address', name: 'token1' }, { type: 'uint256', name: 'reserve0' }, { type: 'uint256', name: 'reserve1' }, { type: 'uint256', name: 'totalSupply' }, { type: 'uint256', name: 'lastUpdateTime' }, { type: 'bool', name: 'exists' }] },
  { type: 'function', name: 'setTokenSupport', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: '_token' }, { type: 'bool', name: '_supported' }], outputs: [] },
  { type: 'function', name: 'createPool', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: '_token0' }, { type: 'address', name: '_token1' }, { type: 'uint256', name: '_amount0' }, { type: 'uint256', name: '_amount1' }], outputs: [] }
]

const CHAINS = {
  arbitrum: { chainId: 421614, name: 'Arbitrum Sepolia', rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x8422972b99AD56341C36480CCCA687E11A55662F', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43', explorer: 'https://sepolia.arbiscan.io' },
  optimism: { chainId: 11155420, name: 'Optimism Sepolia', rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F', weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa', usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13', explorer: 'https://sepolia-optimism.etherscan.io' },
  base: { chainId: 84532, name: 'Base Sepolia', rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43', explorer: 'https://sepolia.basescan.org' }
}

function sortPair(a, b) { return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a] }

async function main() {
  // public client per chain when needed
  for (const [name, cfg] of Object.entries(CHAINS)) {
    const client = createPublicClient({ chain: { id: cfg.chainId, name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpc] }, public: { http: [cfg.rpc] } } }, transport: http(cfg.rpc) })
    const [t0, t1] = sortPair(cfg.weth, cfg.usdc)
    const owner = await client.readContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'owner' }).catch(() => '0x0000000000000000000000000000000000000000')
    let pool
    try { pool = await client.readContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'getPool', args: [t0, t1] }) } catch {}
    const exists = !!pool?.exists
    // Suggest default seed sizes: 0.5 WETH, 1500 USDC (decimals-aware)
    const wethDec = 18
    const usdcDec = 6
    const seedWETH = parseUnits('0.5', wethDec)
    const seedUSDC = parseUnits('1500', usdcDec)
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
        setSupportWETH: encodeFunctionData({ abi: AMM_ABI, functionName: 'setTokenSupport', args: [cfg.weth, true] }),
        setSupportUSDC: encodeFunctionData({ abi: AMM_ABI, functionName: 'setTokenSupport', args: [cfg.usdc, true] }),
        createPool: encodeFunctionData({ abi: AMM_ABI, functionName: 'createPool', args: [t0, t1, amt0, amt1] })
      }
    }
    console.log(JSON.stringify(data, null, 2))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
