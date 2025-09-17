#!/usr/bin/env node
// Create WETH/USDC pools and seed minimal liquidity on ARB/OP/BASE
// Requires: PRIVATE_KEY in env; uses RPC defaults if not set
import dotenv from 'dotenv'
import path from 'path'
import { ethers } from 'ethers'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
]
const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
]
const AMM_ABI = [
  'function setTokenSupport(address _token, bool _supported) external',
  'function owner() view returns (address)',
  'function getPool(address _token0, address _token1) external view returns (tuple(address token0,address token1,uint256 reserve0,uint256 reserve1,uint256 totalSupply,uint256 lastUpdateTime,bool exists))',
  'function createPool(address _token0, address _token1, uint256 _amount0, uint256 _amount1) external',
  'function addLiquidity(address _token0, address _token1, uint256 _amount0, uint256 _amount1, uint256 _minLiquidity) external returns (uint256)'
]

const CHAINS = {
  arbitrum: {
    chainId: 421614,
    rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
    amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
    weth: '0x8422972b99AD56341C36480CCCA687E11A55662F',
    usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
  },
  optimism: {
    chainId: 11155420,
    rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io',
    amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F',
    weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa',
    usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
  },
  base: {
    chainId: 84532,
    rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
    amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
    weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8',
    usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
  },
}

const rawPk = (process.env.PRIVATE_KEY || '').trim()
const PRIVATE_KEY = rawPk ? (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) : ''
if (!PRIVATE_KEY || PRIVATE_KEY.length < 66) {
  console.error('Set PRIVATE_KEY in env (0x-prefixed or raw 64-hex)')
  process.exit(1)
}

function sortPair(a, b) { return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a] }

async function ensurePoolAndLiquidity(name, cfg) {
  console.log(`\n=== ${name.toUpperCase()} (${cfg.chainId}) ===`)
  const provider = new ethers.JsonRpcProvider(cfg.rpc)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const me = await wallet.getAddress()
  console.log('Account:', me)

  // Sanity: contracts exist
  for (const [label, addr] of [['AMM', cfg.amm], ['WETH', cfg.weth], ['USDC', cfg.usdc]]) {
    const code = await provider.getCode(addr)
    if (!code || code === '0x') throw new Error(`${label} not found at ${addr}`)
  }

  const amm = new ethers.Contract(cfg.amm, AMM_ABI, wallet)
  const weth = new ethers.Contract(cfg.weth, WETH_ABI, wallet)
  const usdc = new ethers.Contract(cfg.usdc, ERC20_ABI, wallet)

  // Determine token0/token1 order
  const [t0, t1] = sortPair(cfg.weth, cfg.usdc)

  // Ensure token support
  try { await (await amm.setTokenSupport(cfg.weth, true)).wait() } catch {}
  try { await (await amm.setTokenSupport(cfg.usdc, true)).wait() } catch {}

  // Amounts
  const wethDec = await weth.decimals().catch(() => 18)
  const usdcDec = await usdc.decimals().catch(() => 6)
  const seedWETH = ethers.parseUnits(process.env.SEED_WETH || '0.05', wethDec)
  const seedUSDC = ethers.parseUnits(process.env.SEED_USDC || '150', usdcDec)

  // Wrap ETH if needed
  const wethBal = await weth.balanceOf(me)
  if (wethBal < seedWETH) {
    const need = seedWETH - wethBal
    console.log('Wrapping ETH to WETH:', ethers.formatUnits(need, wethDec))
    const tx = await weth.deposit({ value: need })
    await tx.wait()
  }

  // Approvals
  const allowW = await weth.allowance(me, cfg.amm).catch(() => 0n)
  if (allowW < seedWETH) { console.log('Approving WETH...'); await (await weth.approve(cfg.amm, seedWETH)).wait() }
  const allowU = await usdc.allowance(me, cfg.amm).catch(() => 0n)
  if (allowU < seedUSDC) { console.log('Approving USDC...'); await (await usdc.approve(cfg.amm, seedUSDC)).wait() }

  // Create pool or add liquidity (order-aware)
  let pool
  try { pool = await amm.getPool(t0, t1) } catch {}
  const amt0 = t0.toLowerCase() === cfg.weth.toLowerCase() ? seedWETH : seedUSDC
  const amt1 = t1.toLowerCase() === cfg.usdc.toLowerCase() ? seedUSDC : seedWETH
  if (!pool || !pool.exists) {
    console.log('Creating pool WETH/USDC with initial amounts:', amt0.toString(), amt1.toString())
    try { const tx = await amm.createPool(t0, t1, amt0, amt1); const rc = await tx.wait(); console.log('Pool created. tx:', rc?.hash) } 
    catch (e) { console.warn('createPool failed:', e?.shortMessage || e?.message || e); throw e }
  } else {
    console.log('Pool exists; adding liquidity...')
    try {
      const tx = await amm.addLiquidity(t0, t1, amt0, amt1, 0)
      const rc = await tx.wait()
      console.log('Liquidity added. tx:', rc?.hash)
    } catch (e) {
      console.error('addLiquidity failed:', e?.shortMessage || e?.message || e)
      throw e
    }
  }
}

for (const [name, cfg] of Object.entries(CHAINS)) {
  // eslint-disable-next-line no-await-in-loop
  await ensurePoolAndLiquidity(name, cfg)
}

console.log('\nAll done.')
