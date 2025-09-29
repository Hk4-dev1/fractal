#!/usr/bin/env node
// Migrated from ethers -> viem
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })
import { createPublicClient, http, parseUnits, formatUnits } from 'viem'
import { encodeFunctionData } from 'viem'

// Minimal ABIs as viem fragments
const ERC20_ABI = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
]

const AMM_ABI = [
  { type: 'function', name: 'getSwapQuote', stateMutability: 'view', inputs: [
    { name: '_tokenIn', type: 'address' },
    { name: '_tokenOut', type: 'address' },
    { name: '_amountIn', type: 'uint256' }
  ], outputs: [
    { name: 'amountIn', type: 'uint256' },
    { name: 'amountOut', type: 'uint256' },
    { name: 'fee', type: 'uint256' },
    { name: 'priceImpact', type: 'uint256' }
  ] }
]

const CHAINS = {
  ethereum: { chainId: 11155111, rpc: process.env.RPC_ETHEREUM_SEPOLIA || 'https://ethereum-sepolia.publicnode.com', amm: '0x963aED7a6A603edc51F2938af0bdFFadEf28e9bC', weth: '0x0eA0d0923BC5ac5d17DdEc73Af06FaC1a7816927', usdc: '0x787a258717489a07a537d1377A0ee14767BB53c4' },
  arbitrum: { chainId: 421614, rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x8422972b99AD56341C36480CCCA687E11A55662F', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
  optimism: { chainId: 11155420, rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F', weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa', usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13' },
  base: { chainId: 84532, rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
}

function makeClient(rpc, chainId) {
  // Ad-hoc chain object (enough for viem)
  return createPublicClient({ chain: { id: chainId, name: 'custom', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] }, public: { http: [rpc] } } }, transport: http(rpc) })
}

async function readDecimals(client, address) {
  try {
    return await client.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' })
  } catch { return 6 }
}

async function quote(c) {
  const client = makeClient(c.rpc, c.chainId)
  const amt = parseUnits('0.01', 18)
  const res = await client.readContract({ address: c.amm, abi: AMM_ABI, functionName: 'getSwapQuote', args: [c.weth, c.usdc, amt] })
  // res is tuple: [amountIn, amountOut, fee, priceImpact]
  const [, amountOut, fee, priceImpact] = res
  const usdcDec = await readDecimals(client, c.usdc)
  return {
    amountOut: Number(formatUnits(amountOut, usdcDec)),
    feeEth: Number(formatUnits(fee, 18)),
    priceImpactBps: Number(priceImpact),
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
