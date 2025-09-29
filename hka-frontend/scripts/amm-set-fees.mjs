#!/usr/bin/env node
// Migrated from ethers -> viem
import dotenv from 'dotenv'
import path from 'path'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const AMM_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'FEE_DENOMINATOR', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'swapFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'protocolFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'updateFees', stateMutability: 'nonpayable', inputs: [ { type: 'uint256', name: '_swapFee' }, { type: 'uint256', name: '_protocolFee' } ], outputs: [] }
]

const CHAINS = {
  ethereum: { chainId: 11155111, rpc: process.env.RPC_ETHEREUM_SEPOLIA || 'https://ethereum-sepolia.publicnode.com', amm: '0x963aED7a6A603edc51F2938af0bdFFadEf28e9bC' },
  arbitrum: { chainId: 421614, rpc: process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3' },
  optimism: { chainId: 11155420, rpc: process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', amm: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F' },
  base: { chainId: 84532, rpc: process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', amm: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3' },
}

function pctToUnits(denom, pctStr) {
  // pctStr like '0.2' for 0.2%, '0.05' for 0.05%
  const [intPart, fracPartRaw] = pctStr.split('.')
  const fracPart = (fracPartRaw || '') + '0'.repeat(Math.max(0, 3 - (fracPartRaw || '').length))
  // Convert percent to per-mille (‰) fixed with 3 decimals precision
  // units = floor(denom * (int.frac) / 100)
  const num = BigInt(intPart || '0') * 1000n + BigInt(fracPart.slice(0, 3) || '0')
  // percent value with 3 decimals: e.g., 0.2% => 0.200 => num=200; 0.05% => 0.050 => num=50
  return (denom * num) / (100n * 1000n)
}

async function main() {
  const rawPk = (process.env.PRIVATE_KEY || '').trim()
  const PRIVATE_KEY = rawPk ? (rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`) : ''
  if (!PRIVATE_KEY || PRIVATE_KEY.length !== 66) {
    console.error('Set PRIVATE_KEY in env (0x-prefixed 64 hex)')
    process.exit(1)
  }

  // Defaults: swapFee=0.2%, protocolFee=0.05%
  const swapPct = process.env.AMM_SWAP_FEE_PCT || '0.2'
  const protoPct = process.env.AMM_PROTOCOL_FEE_PCT || '0.05'

  for (const [name, cfg] of Object.entries(CHAINS)) {
    console.log(`\n=== ${name.toUpperCase()} (${cfg.chainId}) ===`)
  const chainObj = { id: cfg.chainId, name: name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpc] }, public: { http: [cfg.rpc] } } }
  const account = privateKeyToAccount(PRIVATE_KEY)
  const publicClient = createPublicClient({ chain: chainObj, transport: http(cfg.rpc) })
  const walletClient = createWalletClient({ account, chain: chainObj, transport: http(cfg.rpc) })
  const me = account.address

  const owner = await publicClient.readContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'owner' }).catch(() => '0x')
    if (owner.toLowerCase() !== me.toLowerCase()) {
      console.log(`Skip: caller not owner. Owner=${owner}`)
      continue
    }
  const denom = await publicClient.readContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'FEE_DENOMINATOR' }).catch(() => 100000n)
  const wantSwap = pctToUnits(denom, swapPct)
  const wantProto = pctToUnits(denom, protoPct)
  const curSwap = await publicClient.readContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'swapFee' }).catch(() => 0n)
  const curProto = await publicClient.readContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'protocolFee' }).catch(() => 0n)
    console.log('Current:', { swap: curSwap.toString(), proto: curProto.toString(), denom: denom.toString() })
    console.log('Target :', { swap: wantSwap.toString(), proto: wantProto.toString() })

    if (curSwap === wantSwap && curProto === wantProto) {
      console.log('Already set; skipping.')
      continue
    }

  const hash = await walletClient.writeContract({ address: cfg.amm, abi: AMM_ABI, functionName: 'updateFees', args: [wantSwap, wantProto] })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('Fees updated. tx:', receipt.transactionHash)
  }
}

main().catch((e) => { console.error(e?.shortMessage || e?.message || e); process.exit(1) })
