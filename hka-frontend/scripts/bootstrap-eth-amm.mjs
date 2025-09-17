#!/usr/bin/env node
// Seed ETH-native AMM (ETH <-> USDC) liquidity on ARB/OP/BASE
import dotenv from 'dotenv'
import path from 'path'
import { ethers } from 'ethers'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount) returns (bool)'
]
const AMM_ETH_ABI = [
  'function getReserves() view returns (uint256 ethReserve, uint256 usdcReserve)',
  'function addLiquidity(uint256 usdcAmount) payable',
]

const CHAINS = {
  arbitrum: {
    chainId: 421614,
    rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
    amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
    usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
  },
  optimism: {
    chainId: 11155420,
    rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io',
    amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F',
    usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
  },
  base: {
    chainId: 84532,
    rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
    amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
    usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
  },
}

const rawPk = (process.env.PRIVATE_KEY || '').trim()
const PRIVATE_KEY = rawPk ? (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) : ''
if (!PRIVATE_KEY || PRIVATE_KEY.length < 66) {
  console.error('Set PRIVATE_KEY in env (0x-prefixed or raw 64-hex)')
  process.exit(1)
}

async function seed(name, cfg) {
  console.log(`\n=== ${name.toUpperCase()} (${cfg.chainId}) ===`)
  const provider = new ethers.JsonRpcProvider(cfg.rpc)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const me = await wallet.getAddress()
  console.log('Account:', me)

  const amm = new ethers.Contract(cfg.amm, AMM_ETH_ABI, wallet)
  const usdc = new ethers.Contract(cfg.usdc, ERC20_ABI, wallet)

  // Check AMM code exists
  const code = await provider.getCode(cfg.amm)
  if (!code || code === '0x') throw new Error(`AMM not found at ${cfg.amm}`)

  // Prepare amounts
  const ethAmt = ethers.parseEther(process.env.SEED_ETH || '0.05')
  const usdcAmt = ethers.parseUnits(process.env.SEED_USDC || '150', 6)

  // Ensure USDC balance; try mint
  let usdcBal = await usdc.balanceOf(me)
  if (usdcBal < usdcAmt) {
    console.log('Trying to mint USDC (Mock)...')
    try {
      const tx = await usdc.mint(me, usdcAmt - usdcBal)
      await tx.wait()
      usdcBal = await usdc.balanceOf(me)
      console.log('USDC minted, balance:', ethers.formatUnits(usdcBal, 6))
    } catch {
      console.log('Mint failed. Please fund USDC manually if needed.')
    }
  }

  // Approve USDC for AMM
  const allowance = await usdc.allowance(me, cfg.amm).catch(() => 0n)
  if (allowance < usdcAmt) {
    console.log('Approving USDC...')
    await (await usdc.approve(cfg.amm, usdcAmt)).wait()
  }

  // Add liquidity
  try {
    const reserves = await amm.getReserves().catch(() => null)
    console.log('Current reserves:', reserves)
    console.log('Adding liquidity (ETH, USDC):', ethers.formatEther(ethAmt), Number(ethers.formatUnits(usdcAmt, 6)))
    const tx = await amm.addLiquidity(usdcAmt, { value: ethAmt })
    const rc = await tx.wait()
    console.log('Liquidity added. tx:', rc?.hash)
  } catch (e) {
    console.error('addLiquidity failed:', e?.shortMessage || e?.message || e)
    throw e
  }
}

for (const [name, cfg] of Object.entries(CHAINS)) {
  // eslint-disable-next-line no-await-in-loop
  await seed(name, cfg)
}

console.log('\nAll done.')
