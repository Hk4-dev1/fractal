#!/usr/bin/env node
// Seed ETH-native AMM (ETH <-> USDC) liquidity on ARB/OP/BASE
import dotenv from 'dotenv'
import path from 'path'
import { createPublicClient, createWalletClient, http, parseUnits, parseAbi, formatEther, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount) returns (bool)'
])
const AMM_ETH_ABI = parseAbi([
  'function getReserves() view returns (uint256 ethReserve, uint256 usdcReserve)',
  'function addLiquidity(uint256 usdcAmount) payable'
])

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
  const account = privateKeyToAccount(PRIVATE_KEY)
  const chain = { id: cfg.chainId, name, network: name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpc] } } }
  const publicClient = createPublicClient({ chain, transport: http(cfg.rpc) })
  const walletClient = createWalletClient({ account, chain, transport: http(cfg.rpc) })
  const me = account.address
  console.log('Account:', me)

  // Bytecode sanity
  const code = await publicClient.getBytecode({ address: cfg.amm })
  if (!code || code === '0x') throw new Error(`AMM not found at ${cfg.amm}`)

  async function read(addr, abi, fn, args=[]) { return publicClient.readContract({ address: addr, abi, functionName: fn, args }) }

  // Prepare amounts
  const ethAmt = parseUnits(process.env.SEED_ETH || '0.05', 18)
  const usdcAmt = parseUnits(process.env.SEED_USDC || '150', 6)

  // Ensure USDC balance; try mint
  let usdcBal = await read(cfg.usdc, ERC20_ABI, 'balanceOf', [me])
  if (usdcBal < usdcAmt) {
    console.log('Trying to mint USDC (Mock)...')
    try {
      const hash = await walletClient.writeContract({ address: cfg.usdc, abi: ERC20_ABI, functionName: 'mint', args: [me, usdcAmt - usdcBal] })
      await publicClient.waitForTransactionReceipt({ hash })
      usdcBal = await read(cfg.usdc, ERC20_ABI, 'balanceOf', [me])
      console.log('USDC minted, balance:', Number(usdcBal) / 1e6)
    } catch {
      console.log('Mint failed. Please fund USDC manually if needed.')
    }
  }

  // Approve USDC for AMM
  const allowance = await read(cfg.usdc, ERC20_ABI, 'allowance', [me, cfg.amm]).catch(() => 0n)
  if (allowance < usdcAmt) {
    console.log('Approving USDC...')
    const hash = await walletClient.writeContract({ address: cfg.usdc, abi: ERC20_ABI, functionName: 'approve', args: [cfg.amm, usdcAmt] })
    await publicClient.waitForTransactionReceipt({ hash })
  }

  // Add liquidity
  try {
  const reserves = await publicClient.readContract({ address: cfg.amm, abi: AMM_ETH_ABI, functionName: 'getReserves' }).catch(() => null)
  console.log('Current reserves:', reserves)
  console.log('Adding liquidity (ETH, USDC):', formatEther(ethAmt), Number(usdcAmt) / 1e6)
  const hash = await walletClient.writeContract({ address: cfg.amm, abi: AMM_ETH_ABI, functionName: 'addLiquidity', args: [usdcAmt], value: ethAmt })
  await publicClient.waitForTransactionReceipt({ hash })
  console.log('Liquidity added. tx:', hash)
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
