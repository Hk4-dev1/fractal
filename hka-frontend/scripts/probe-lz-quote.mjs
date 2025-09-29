#!/usr/bin/env node
// Migrated from ethers -> viem
import dotenv from 'dotenv'
import path from 'path'
import { createPublicClient, http } from 'viem'

// Load .env in this folder
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

const ROUTERS = {
  'ethereum-sepolia': '0xb77078E1d22F9390441C84ab0C00f656311b224e',
  'arbitrum-sepolia': '0x3D1D6bc8D8Af01Bff8751b03636c317e3B464b0D',
  'optimism-sepolia': '0x005D2E2fcDbA0740725E848cc1bCc019823f118C',
  'base-sepolia': '0x68bAB827101cD4C55d9994bc738f2ED8FfAB974F',
}

const EIDS = {
  'ethereum-sepolia': 40161,
  'arbitrum-sepolia': 40243,
  'optimism-sepolia': 40232,
  'base-sepolia': 40245,
}

const RPCS = {
  'ethereum-sepolia': process.env.VITE_RPC_ETHEREUM_SEPOLIA || process.env.RPC_ETHEREUM_SEPOLIA || 'https://ethereum-sepolia.publicnode.com',
  'arbitrum-sepolia': process.env.VITE_RPC_ARBITRUM_SEPOLIA || process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
  'optimism-sepolia': process.env.VITE_RPC_OPTIMISM_SEPOLIA || process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io',
  'base-sepolia': process.env.VITE_RPC_BASE_SEPOLIA || process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org',
}

const ROUTER_ABI = [
  { type: 'function', name: 'quote', stateMutability: 'view', inputs: [
    { name: 'dstEid', type: 'uint32' },
    { name: 'payload', type: 'bytes' },
    { name: 'options', type: 'bytes' }
  ], outputs: [
    { name: 'nativeFee', type: 'uint256' },
    { name: 'lzTokenFee', type: 'uint256' }
  ] },
  { type: 'function', name: 'peers', stateMutability: 'view', inputs: [{ type: 'uint32' }], outputs: [{ type: 'bytes32' }] }
]

function buildOptions(gas = 250000n) {
  // Reproduce TYPE3 option structure without ethers helpers.
  const TYPE3 = 3n, WORKER_EXECUTOR_ID = 1n, OPTTYPE_LZRECEIVE = 1n
  // uint128 gas encoded big-endian (viem encodeAbiParameters returns dynamic offset so we hand-roll minimal)
  const gasHex = gas.toString(16).padStart(32, '0') // 16 bytes
  const optBytes = Buffer.from(gasHex, 'hex')
  const size = 1 + optBytes.length // u8 + data
  const header = Buffer.from(TYPE3.toString(16).padStart(4, '0'), 'hex') // uint16
  const execChunk = Buffer.concat([
    Buffer.from(WORKER_EXECUTOR_ID.toString(16).padStart(2,'0'), 'hex'),
    Buffer.from(size.toString(16).padStart(4,'0'), 'hex'),
    Buffer.from(OPTTYPE_LZRECEIVE.toString(16).padStart(2,'0'), 'hex')
  ])
  return '0x' + Buffer.concat([header, execChunk, optBytes]).toString('hex')
}

function randomPayload() {
  // small but non-empty bytes
  return '0x01'
}

async function probe(fromKey, toKey) {
  const rpc = RPCS[fromKey]
  if (!rpc) throw new Error(`Missing RPC for ${fromKey}`)
  const client = createPublicClient({ chain: { id: 0, name: fromKey, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] }, public: { http: [rpc] } } }, transport: http(rpc) })
  const dstEid = EIDS[toKey]
  const payload = randomPayload()
  const options = buildOptions(250000n)
  const code = await client.getBytecode({ address: ROUTERS[fromKey] }).catch(()=> null)
  const hasCode = !!code && code !== '0x'
  const peer = await client.readContract({ address: ROUTERS[fromKey], abi: ROUTER_ABI, functionName: 'peers', args: [dstEid] }).catch(()=> '0x')
  const peerSet = peer && peer !== '0x' + '0'.repeat(64)

  let quoteOk = false
  let nativeFee = null
  let lzFee = null
  let error = null
  try {
    const res = await client.readContract({ address: ROUTERS[fromKey], abi: ROUTER_ABI, functionName: 'quote', args: [dstEid, payload, options] })
    const [nFee, lFee] = res
    nativeFee = nFee.toString()
    lzFee = lFee.toString()
    quoteOk = true
  } catch (e) {
    error = e
  }
  return { fromKey, toKey, hasCode, peerSet, peer, quoteOk, nativeFee, lzFee, error }
}

async function main() {
  const pairs = [
    ['ethereum-sepolia','optimism-sepolia'],
    ['ethereum-sepolia','base-sepolia'],
    ['ethereum-sepolia','arbitrum-sepolia'],
    ['optimism-sepolia','ethereum-sepolia'],
    ['base-sepolia','ethereum-sepolia'],
  ]
  for (const [fromKey, toKey] of pairs) {
    const r = await probe(fromKey, toKey)
    if (r.quoteOk) {
      console.log(`${fromKey} -> ${toKey} OK | peerSet=${r.peerSet} nativeFee=${r.nativeFee}`)
    } else {
      const msg = r.error?.shortMessage || r.error?.message || String(r.error)
      console.log(`${fromKey} -> ${toKey} FAIL | hasCode=${r.hasCode} peerSet=${r.peerSet} peer=${r.peer} err=${msg}`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
