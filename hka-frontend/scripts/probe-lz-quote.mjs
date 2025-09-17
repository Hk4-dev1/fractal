#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
import { ethers } from 'ethers'

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
  'ethereum-sepolia': process.env.VITE_RPC_ETHEREUM_SEPOLIA,
  'arbitrum-sepolia': process.env.VITE_RPC_ARBITRUM_SEPOLIA,
  'optimism-sepolia': process.env.VITE_RPC_OPTIMISM_SEPOLIA,
  'base-sepolia': process.env.VITE_RPC_BASE_SEPOLIA,
}

const ABI = [
  'function quote(uint32 dstEid, bytes payload, bytes options) view returns (uint256 nativeFee, uint256 lzTokenFee)',
  'function peers(uint32) view returns (bytes32)'
]

function buildOptions(gas = 250000n) {
  const TYPE3 = 3n, WORKER_EXECUTOR_ID = 1n, OPTTYPE_LZRECEIVE = 1n
  const opt = ethers.solidityPacked(['uint128'], [gas])
  const optBytes = ethers.getBytes(opt)
  const size = 1 + optBytes.length
  const header = ethers.getBytes(ethers.solidityPacked(['uint16'], [TYPE3]))
  const execChunk = ethers.getBytes(ethers.solidityPacked(['uint8','uint16','uint8'], [WORKER_EXECUTOR_ID, BigInt(size), OPTTYPE_LZRECEIVE]))
  return ethers.hexlify(ethers.concat([header, execChunk, optBytes]))
}

function randomPayload() {
  // small but non-empty bytes
  return '0x01'
}

async function probe(fromKey, toKey) {
  const rpc = RPCS[fromKey]
  if (!rpc) throw new Error(`Missing RPC for ${fromKey}`)
  const provider = new ethers.JsonRpcProvider(rpc)
  const router = new ethers.Contract(ROUTERS[fromKey], ABI, provider)
  const dstEid = EIDS[toKey]
  const payload = randomPayload()
  const options = buildOptions(250000n)

  const code = await provider.getCode(ROUTERS[fromKey])
  const hasCode = code && code !== '0x'
  const peer = await router.peers(dstEid).catch(()=> '0x')
  const peerSet = peer && peer !== ethers.ZeroHash

  let quoteOk = false
  let nativeFee = null
  let lzFee = null
  let error = null
  try {
    const res = await router.quote(dstEid, payload, options)
    nativeFee = res[0]?.toString?.() || String(res.nativeFee)
    lzFee = res[1]?.toString?.() || String(res.lzTokenFee)
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
