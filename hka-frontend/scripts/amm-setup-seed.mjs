#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
import { ethers } from 'ethers'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const AMM_ABI = [
  'function owner() view returns (address)',
  'function setTokenSupport(address _token, bool _supported)',
  'function getPool(address,address) view returns (tuple(address token0,address token1,uint256 reserve0,uint256 reserve1,uint256 totalSupply,uint256 lastUpdateTime,bool exists))',
  // Deployed AMMEngine signatures
  'function createPool(address _token0, address _token1, uint256 _amount0, uint256 _amount1)',
  'function addLiquidity(address _token0, address _token1, uint256 _amount0, uint256 _amount1, uint256 _minLiquidity) returns (uint256)'
]
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount) returns (bool)'
]
const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

const CHAINS = {
  arbitrum: { chainId: 421614, rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x8422972b99AD56341C36480CCCA687E11A55662F', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
  optimism: { chainId: 11155420, rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F', weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa', usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13' },
  base: { chainId: 84532, rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' }
}

const rawPk = (process.env.PRIVATE_KEY || '').trim()
const PRIVATE_KEY = rawPk ? (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) : ''
if (!PRIVATE_KEY || PRIVATE_KEY.length < 66) {
  console.error('Set PRIVATE_KEY in env (0x-prefixed or raw 64-hex)')
  process.exit(1)
}

function sortPair(a, b) { return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a] }

async function run() {
  const seedWethStr = process.env.SEED_WETH || '0.5'
  const seedUsdcStr = process.env.SEED_USDC || '1500'

  for (const [name, cfg] of Object.entries(CHAINS)) {
    console.log(`\n=== ${name.toUpperCase()} (${cfg.chainId}) ===`)
    const provider = new ethers.JsonRpcProvider(cfg.rpc)
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
    const me = await wallet.getAddress()
    console.log('Account:', me)

    const amm = new ethers.Contract(cfg.amm, AMM_ABI, wallet)
    const weth = new ethers.Contract(cfg.weth, WETH_ABI, wallet)
    const usdc = new ethers.Contract(cfg.usdc, ERC20_ABI, wallet)

    // Check owner
    const owner = await amm.owner().catch(() => '0x')
    if (owner.toLowerCase() !== me.toLowerCase()) {
      throw new Error(`Caller is not AMM owner on ${name}. Owner: ${owner}`)
    }

    // Ensure token support (owner-only)
    for (const [label, token] of [['WETH', cfg.weth], ['USDC', cfg.usdc]]) {
      try {
        console.log(`Ensuring support for ${label}...`)
        const tx = await amm.setTokenSupport(token, true)
        await tx.wait()
      } catch (e) {
        console.log(`setTokenSupport(${label}) skipped or already set:`, e?.shortMessage || e?.message || 'ok')
      }
    }

    // Amounts and balances
  const [t0, t1] = sortPair(cfg.weth, cfg.usdc)
  let pool
  try { pool = await amm.getPool(t0, t1) } catch {}
    const wethDec = await weth.decimals().catch(() => 18)
    const usdcDec = await usdc.decimals().catch(() => 6)
    const seedWETH = ethers.parseUnits(seedWethStr, wethDec)
    const seedUSDC = ethers.parseUnits(seedUsdcStr, usdcDec)

    // Wrap ETH to WETH if needed
    const wBal = await weth.balanceOf(me)
    if (wBal < seedWETH) {
      const need = seedWETH - wBal
      console.log('Wrapping ETH -> WETH:', ethers.formatUnits(need, wethDec))
      const tx = await weth.deposit({ value: need })
      await tx.wait()
    }

    // Ensure USDC balance (attempt mint if mock)
    let uBal = await usdc.balanceOf(me)
    if (uBal < seedUSDC) {
      console.log('Minting USDC (if mock)...')
      try { const tx = await usdc.mint(me, seedUSDC - uBal); await tx.wait(); uBal = await usdc.balanceOf(me) } catch {}
      if (uBal < seedUSDC) console.log('USDC mint not available; please fund manually if low')
    }

    // Approvals (required before createPool/addLiquidity)
    const allowW = await weth.allowance(me, cfg.amm).catch(() => 0n)
    if (allowW < seedWETH) { console.log('Approving WETH...'); await (await weth.approve(cfg.amm, seedWETH)).wait() }
    const allowU = await usdc.allowance(me, cfg.amm).catch(() => 0n)
    if (allowU < seedUSDC) { console.log('Approving USDC...'); await (await usdc.approve(cfg.amm, seedUSDC)).wait() }

    // Create pool if missing with initial seed or add liquidity if exists
    const amt0 = t0.toLowerCase() === cfg.weth.toLowerCase() ? seedWETH : seedUSDC
    const amt1 = t1.toLowerCase() === cfg.usdc.toLowerCase() ? seedUSDC : seedWETH
    if (!pool || !pool.exists) {
      console.log('Creating WETH/USDC pool with initial amounts:', amt0.toString(), amt1.toString())
      const tx = await amm.createPool(t0, t1, amt0, amt1)
      await tx.wait()
      console.log('Pool created')
    } else {
      console.log('Pool exists; adding liquidity...')
      const tx = await amm.addLiquidity(t0, t1, amt0, amt1, 0)
      const rc = await tx.wait()
      console.log('Liquidity added. tx:', rc?.hash)
    }
  }
}

run().then(() => console.log('\nAll done.')).catch((e) => { console.error(e); process.exit(1) })
