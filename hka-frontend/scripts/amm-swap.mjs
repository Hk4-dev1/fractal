#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
import { ethers } from 'ethers'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const AMM_ABI = [
  'function swap(address _tokenIn, address _tokenOut, uint256 _amountIn, uint256 _minAmountOut) returns (uint256)'
]
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
]
const WETH_ABI = [
  'function deposit() payable',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

const CHAINS = {
  arbitrum: { chainId: 421614, rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x8422972b99AD56341C36480CCCA687E11A55662F', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
  optimism: { chainId: 11155420, rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F', weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa', usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13' },
  base: { chainId: 84532, rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
}

const rawPk = (process.env.PRIVATE_KEY || '').trim()
const PRIVATE_KEY = rawPk ? (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) : ''
if (!PRIVATE_KEY || PRIVATE_KEY.length < 66) {
  console.error('Set PRIVATE_KEY in env (0x-prefixed or raw 64-hex)')
  process.exit(1)
}

const target = process.argv[2] || 'arbitrum'
const amountEth = process.argv[3] || '0.01'
if (!CHAINS[target]) {
  console.error('Usage: node scripts/amm-swap.mjs <arbitrum|optimism|base> [amountETH]')
  process.exit(1)
}

async function main() {
  const cfg = CHAINS[target]
  console.log(`\n=== Swap on ${target.toUpperCase()} (${cfg.chainId}) ===`)
  const provider = new ethers.JsonRpcProvider(cfg.rpc)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const me = await wallet.getAddress()
  console.log('Account:', me)

  const amm = new ethers.Contract(cfg.amm, AMM_ABI, wallet)
  const weth = new ethers.Contract(cfg.weth, WETH_ABI, wallet)
  const usdc = new ethers.Contract(cfg.usdc, ERC20_ABI, wallet)

  const wethDec = await weth.decimals().catch(() => 18)
  const usdcDec = await usdc.decimals().catch(() => 6)
  const amtIn = ethers.parseUnits(amountEth, 18)

  // Ensure WETH balance
  const wBal = await weth.balanceOf(me)
  if (wBal < amtIn) {
    const need = amtIn - wBal
    console.log('Wrapping ETH -> WETH:', ethers.formatUnits(need, wethDec))
    const tx = await weth.deposit({ value: need })
    await tx.wait()
  }

  // Approve AMM to spend WETH
  const allowW = await weth.allowance(me, cfg.amm).catch(() => 0n)
  if (allowW < amtIn) {
    console.log('Approving WETH...')
    await (await weth.approve(cfg.amm, amtIn)).wait()
  }

  console.log('Swapping WETH -> USDC:', amountEth)
  const tx = await amm.swap(cfg.weth, cfg.usdc, amtIn, 0)
  const rc = await tx.wait()
  console.log('Swap tx:', rc?.hash)
}

main().catch((e) => { console.error(e?.shortMessage || e?.message || e); process.exit(1) })
