#!/usr/bin/env node
// Create TestETH/USDC pools and seed minimal liquidity on non-ETH chains
// Requires: PRIVATE_KEY in env and RPC_... URLs (or uses defaults)
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })
import { ethers } from 'ethers'

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount) returns (bool)'
]
// ERC20 for TestETH and USDC
const AMM_ABI = [
  'function setTokenSupport(address _token, bool _supported) external',
  'function owner() view returns (address)',
  'function getPool(address _token0, address _token1) external view returns (tuple(address token0,address token1,uint256 reserve0,uint256 reserve1,uint256 totalSupply,uint256 lastUpdateTime,bool exists))',
  'function createPool(address _token0, address _token1) external',
  'function addLiquidity(address _token0, address _token1, uint256 _amount0, uint256 _amount1, uint256 _minAmount0, uint256 _minAmount1) external returns (uint256)'
]

const CHAINS = {
  arbitrum: {
    chainId: 421614,
    rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
    amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
  tokenA: process.env.VITE_ARBITRUM_SEPOLIA_TESTETH_ADDRESS,
  tokenB: process.env.VITE_ARBITRUM_SEPOLIA_TESTUSDC_ADDRESS,
  },
  optimism: {
    chainId: 11155420,
    rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io',
    amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F',
  tokenA: process.env.VITE_OPTIMISM_SEPOLIA_TESTETH_ADDRESS,
  tokenB: process.env.VITE_OPTIMISM_SEPOLIA_TESTUSDC_ADDRESS,
  },
  base: {
    chainId: 84532,
    rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
    amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
  tokenA: process.env.VITE_BASE_SEPOLIA_TESTETH_ADDRESS,
  tokenB: process.env.VITE_BASE_SEPOLIA_TESTUSDC_ADDRESS,
  },
}

const rawPk = (process.env.PRIVATE_KEY || '').trim()
const PRIVATE_KEY = rawPk ? (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) : ''
if (!PRIVATE_KEY || PRIVATE_KEY.length < 66) {
  console.error('Set PRIVATE_KEY in env to fund and create pools (0x-prefixed or raw 64-hex)')
  process.exit(1)
}

async function ensurePoolAndLiquidity(name, cfg) {
  console.log(`\n=== ${name.toUpperCase()} (${cfg.chainId}) ===`)
  const provider = new ethers.JsonRpcProvider(cfg.rpc)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const me = await wallet.getAddress()
  console.log('Account:', me)

  const code = await provider.getCode(cfg.amm)
  if (!code || code === '0x') {
    console.error('AMM contract not found at', cfg.amm)
    process.exit(1)
  }
  const amm = new ethers.Contract(cfg.amm, AMM_ABI, wallet)
  try {
    const own = await amm.owner()
    console.log('AMM.owner:', own)
  } catch {}

  // Verify token contracts
  const codeA = await provider.getCode(cfg.tokenA)
  const codeB = await provider.getCode(cfg.tokenB)
  if (!codeA || codeA === '0x') console.error('WARN: tokenA code not found at', cfg.tokenA)
  if (!codeB || codeB === '0x') console.error('WARN: tokenB code not found at', cfg.tokenB)

  // Support tokens
  try { await (await amm.setTokenSupport(cfg.tokenA, true)).wait() } catch {}
  try { await (await amm.setTokenSupport(cfg.tokenB, true)).wait() } catch {}

  // Sort pair (token0 < token1)
  const [t0, t1] = cfg.tokenA.toLowerCase() < cfg.tokenB.toLowerCase()
    ? [cfg.tokenA, cfg.tokenB]
    : [cfg.tokenB, cfg.tokenA]
  console.log('Pair token0/token1:', t0, t1)

  // Create pool if missing
  let pool
  try {
    pool = await amm.getPool(t0, t1)
    console.log('Pool struct:', pool)
  } catch {}
  if (!pool || !pool.exists) {
    try {
      const owner = await amm.owner().catch(() => null)
      if (owner && owner.toLowerCase() !== me.toLowerCase()) {
        console.warn('Warning: caller is not AMM owner. createPool may revert.')
      }
      console.log('Creating pool...')
      const tx = await amm.createPool(t0, t1)
      await tx.wait()
      console.log('Pool created')
    } catch (e) {
      console.error('createPool failed:', e?.shortMessage || e?.message || e)
      console.warn('Continuing to try addLiquidity anyway...')
    }
  } else {
    console.log('Pool already exists')
  }

  // Prepare amounts via decimals
  const tokenA = new ethers.Contract(cfg.tokenA, ERC20_ABI, wallet)
  const tokenB = new ethers.Contract(cfg.tokenB, ERC20_ABI, wallet)
  const decA = await tokenA.decimals().catch(() => 18)
  const decB = await tokenB.decimals().catch(() => 6)
  const amtA = ethers.parseUnits(process.env.SEED_ETH || '0.05', decA)
  const amtB = ethers.parseUnits(process.env.SEED_USDC || '150', decB)

  // Mint/ensure balances
  let balA = await tokenA.balanceOf(me)
  if (balA < amtA) {
    console.log('Trying to mint tokenA (TestETH)...')
    try { const tx = await tokenA.mint(me, amtA - balA); await tx.wait() } catch {}
    balA = await tokenA.balanceOf(me)
  }
  let balB = await tokenB.balanceOf(me)
  if (balB < amtB) {
    console.log('Trying to mint tokenB (USDC)...')
    try { const tx = await tokenB.mint(me, amtB - balB); await tx.wait() } catch {}
    balB = await tokenB.balanceOf(me)
  }

  // Approvals
  const allowA = await tokenA.allowance(me, cfg.amm).catch(() => 0n)
  if (allowA < amtA) { console.log('Approving tokenA...'); await (await tokenA.approve(cfg.amm, amtA)).wait() }
  const allowB = await tokenB.allowance(me, cfg.amm).catch(() => 0n)
  if (allowB < amtB) { console.log('Approving tokenB...'); await (await tokenB.approve(cfg.amm, amtB)).wait() }

  // Add liquidity
  console.log('Adding liquidity...')
  const amt0 = t0.toLowerCase() === cfg.tokenA.toLowerCase() ? amtA : amtB
  const amt1 = t1.toLowerCase() === cfg.tokenB.toLowerCase() ? amtB : amtA
  const tx = await amm.addLiquidity(t0, t1, amt0, amt1, 0, 0)
  const rc = await tx.wait()
  console.log('Liquidity added. tx:', rc?.hash)
}

for (const [name, cfg] of Object.entries(CHAINS)) {
  // eslint-disable-next-line no-await-in-loop
  await ensurePoolAndLiquidity(name, cfg)
}

console.log('\nAll done.')
