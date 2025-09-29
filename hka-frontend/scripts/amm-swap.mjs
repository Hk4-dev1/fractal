#!/usr/bin/env node
// Migrated from ethers -> viem
import dotenv from 'dotenv'
import path from 'path'
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

// Minimal ABIs in viem fragment form
const AMM_ABI = [
  { type: 'function', name: 'swap', stateMutability: 'nonpayable', inputs: [
    { name: '_tokenIn', type: 'address' },
    { name: '_tokenOut', type: 'address' },
    { name: '_amountIn', type: 'uint256' },
    { name: '_minAmountOut', type: 'uint256' }
  ], outputs: [{ type: 'uint256' }] }
]
const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'value' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'spender' }], outputs: [{ type: 'uint256' }] }
]
const WETH_ABI = [
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'value' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'spender' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
]

const CHAINS = {
  arbitrum: { chainId: 421614, rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x8422972b99AD56341C36480CCCA687E11A55662F', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
  optimism: { chainId: 11155420, rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F', weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa', usdc: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13' },
  base: { chainId: 84532, rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3', weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8', usdc: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43' },
}

const rawPk = (process.env.PRIVATE_KEY || '').trim()
const PRIVATE_KEY = rawPk ? (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) : ''
if (!PRIVATE_KEY || PRIVATE_KEY.length !== 66) {
  console.error('Set PRIVATE_KEY in env (0x-prefixed 64 hex)')
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
  const chainObj = { id: cfg.chainId, name: target, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpc] }, public: { http: [cfg.rpc] } } }
  const publicClient = createPublicClient({ chain: chainObj, transport: http(cfg.rpc) })
  const account = privateKeyToAccount(PRIVATE_KEY)
  const walletClient = createWalletClient({ account, chain: chainObj, transport: http(cfg.rpc) })
  const me = account.address
  console.log('Account:', me)

  async function readDec(addr) {
    try { return await publicClient.readContract({ address: addr, abi: WETH_ABI, functionName: 'decimals' }) } catch { return 18 }
  }
  const wethDec = await readDec(cfg.weth)
  const usdcDec = await (async () => { try { return await publicClient.readContract({ address: cfg.usdc, abi: ERC20_ABI, functionName: 'decimals' }) } catch { return 6 } })()
  const amtIn = parseUnits(amountEth, 18)

  // WETH balance check
  const wBal = await publicClient.readContract({ address: cfg.weth, abi: WETH_ABI, functionName: 'balanceOf', args: [me] })
  if (wBal < amtIn) {
    const need = amtIn - wBal
    console.log('Wrapping ETH -> WETH:', formatUnits(need, wethDec))
    const depositHash = await walletClient.writeContract({ address: cfg.weth, abi: WETH_ABI, functionName: 'deposit', value: need })
    await publicClient.waitForTransactionReceipt({ hash: depositHash })
  }

  // Allowance
  const allowW = await publicClient.readContract({ address: cfg.weth, abi: WETH_ABI, functionName: 'allowance', args: [me, cfg.amm] })
  if (allowW < amtIn) {
    console.log('Approving WETH...')
    const approveHash = await walletClient.writeContract({ address: cfg.weth, abi: WETH_ABI, functionName: 'approve', args: [cfg.amm, amtIn] })
    await publicClient.waitForTransactionReceipt({ hash: approveHash })
  }

  console.log('Swapping WETH -> USDC:', amountEth)
  const swapHash = await walletClient.writeContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'swap', args: [cfg.weth, cfg.usdc, amtIn, 0n] })
  const rc = await publicClient.waitForTransactionReceipt({ hash: swapHash })
  console.log('Swap tx:', rc.transactionHash)
}

main().catch((e) => { console.error(e?.shortMessage || e?.message || e); process.exit(1) })
