#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
import { createPublicClient, createWalletClient, http, parseUnits, parseAbi, getAddress, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const AMM_ABI = [
  ...parseAbi([
    'function owner() view returns (address)',
    'function setTokenSupport(address _token, bool _supported)',
    'function createPool(address _token0, address _token1, uint256 _amount0, uint256 _amount1)',
    'function addLiquidity(address _token0, address _token1, uint256 _amount0, uint256 _amount1, uint256 _minLiquidity) returns (uint256)'
  ]),
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [ { name: 'token0', type: 'address' }, { name: 'token1', type: 'address' } ],
    outputs: [ {
      type: 'tuple',
      components: [
        { name: 'token0', type: 'address' },
        { name: 'token1', type: 'address' },
        { name: 'reserve0', type: 'uint256' },
        { name: 'reserve1', type: 'uint256' },
        { name: 'totalSupply', type: 'uint256' },
        { name: 'lastUpdateTime', type: 'uint256' },
        { name: 'exists', type: 'bool' }
      ]
    } ]
  }
]
const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount) returns (bool)'
])
const WETH_ABI = parseAbi([
  'function deposit() payable',
  'function withdraw(uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
])

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
    const account = privateKeyToAccount(PRIVATE_KEY)
    const chain = { id: cfg.chainId, name, network: name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpc] } } }
    const publicClient = createPublicClient({ chain, transport: http(cfg.rpc) })
    const walletClient = createWalletClient({ account, chain, transport: http(cfg.rpc) })
    const me = account.address
    console.log('Account:', me)

    // Read owner
    const owner = await publicClient.readContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'owner' }).catch(() => '0x')
    if (owner.toLowerCase() !== me.toLowerCase()) {
      throw new Error(`Caller is not AMM owner on ${name}. Owner: ${owner}`)
    }

    // Ensure token support (owner-only)
    for (const [label, token] of [['WETH', cfg.weth], ['USDC', cfg.usdc]]) {
      try {
        console.log(`Ensuring support for ${label}...`)
        const hash = await walletClient.writeContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'setTokenSupport', args: [token, true] })
        await publicClient.waitForTransactionReceipt({ hash })
      } catch (e) {
        console.log(`setTokenSupport(${label}) skipped or already set:`, e?.shortMessage || e?.message || 'ok')
      }
    }

    // Amounts and balances
    const [t0raw, t1raw] = sortPair(cfg.weth, cfg.usdc)
    const t0 = getAddress(t0raw); const t1 = getAddress(t1raw)
    let pool
    try { pool = await publicClient.readContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'getPool', args: [t0, t1] }) } catch {}
    const wethDec = await publicClient.readContract({ address: cfg.weth, abi: WETH_ABI, functionName: 'decimals' }).catch(() => 18)
    const usdcDec = await publicClient.readContract({ address: cfg.usdc, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 6)
    const seedWETH = parseUnits(seedWethStr, wethDec)
    const seedUSDC = parseUnits(seedUsdcStr, usdcDec)

    // Wrap ETH to WETH if needed
    const wBal = await publicClient.readContract({ address: cfg.weth, abi: WETH_ABI, functionName: 'balanceOf', args: [me] })
    if (wBal < seedWETH) {
      const need = seedWETH - wBal
      console.log('Wrapping ETH -> WETH:', formatUnits(need, wethDec))
      try {
        const hash = await walletClient.writeContract({ address: cfg.weth, abi: WETH_ABI, functionName: 'deposit', value: need })
        await publicClient.waitForTransactionReceipt({ hash })
      } catch (e) {
        console.error('deposit failed:', e?.shortMessage || e?.message || e)
      }
    }

    // Ensure USDC balance (attempt mint if mock)
    let uBal = await publicClient.readContract({ address: cfg.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [me] })
    if (uBal < seedUSDC) {
      console.log('Minting USDC (if mock)...')
      try {
        const hash = await walletClient.writeContract({ address: cfg.usdc, abi: ERC20_ABI, functionName: 'mint', args: [me, seedUSDC - uBal] })
        await publicClient.waitForTransactionReceipt({ hash })
        uBal = await publicClient.readContract({ address: cfg.usdc, abi: ERC20_ABI, functionName: 'balanceOf', args: [me] })
      } catch {}
      if (uBal < seedUSDC) console.log('USDC mint not available; please fund manually if low')
    }

    // Approvals (required before createPool/addLiquidity)
    const allowW = await publicClient.readContract({ address: cfg.weth, abi: WETH_ABI, functionName: 'allowance', args: [me, cfg.amm] }).catch(() => 0n)
    if (allowW < seedWETH) {
      console.log('Approving WETH...')
      const hash = await walletClient.writeContract({ address: cfg.weth, abi: WETH_ABI, functionName: 'approve', args: [cfg.amm, seedWETH] })
      await publicClient.waitForTransactionReceipt({ hash })
    }
    const allowU = await publicClient.readContract({ address: cfg.usdc, abi: ERC20_ABI, functionName: 'allowance', args: [me, cfg.amm] }).catch(() => 0n)
    if (allowU < seedUSDC) {
      console.log('Approving USDC...')
      const hash = await walletClient.writeContract({ address: cfg.usdc, abi: ERC20_ABI, functionName: 'approve', args: [cfg.amm, seedUSDC] })
      await publicClient.waitForTransactionReceipt({ hash })
    }

    // Create pool if missing with initial seed or add liquidity if exists
    const amt0 = t0.toLowerCase() === cfg.weth.toLowerCase() ? seedWETH : seedUSDC
    const amt1 = t1.toLowerCase() === cfg.usdc.toLowerCase() ? seedUSDC : seedWETH
    if (!pool || !pool.exists) {
      console.log('Creating WETH/USDC pool with initial amounts:', amt0.toString(), amt1.toString())
      try {
        const hash = await walletClient.writeContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'createPool', args: [t0, t1, amt0, amt1] })
        await publicClient.waitForTransactionReceipt({ hash })
        console.log('Pool created')
      } catch (e) {
        console.error('createPool failed:', e?.shortMessage || e?.message || e)
      }
    } else {
      console.log('Pool exists; adding liquidity...')
      try {
        const hash = await walletClient.writeContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'addLiquidity', args: [t0, t1, amt0, amt1, 0n] })
        await publicClient.waitForTransactionReceipt({ hash })
        console.log('Liquidity added. tx:', hash)
      } catch (e) {
        console.error('addLiquidity failed:', e?.shortMessage || e?.message || e)
      }
    }
  }
}

run().then(() => console.log('\nAll done.')).catch((e) => { console.error(e); process.exit(1) })
