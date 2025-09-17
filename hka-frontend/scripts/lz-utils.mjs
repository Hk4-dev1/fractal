// LayerZero peer tools (ESM)
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })
import { ethers } from 'ethers'

// Chain definitions (keep in sync with app)
const CHAINS = {
  // Use OApp contract addresses (your app) for setPeer/peers
  ethereum: { key: 'ethereum-sepolia', chainId: 11155111, eid: 40161, oapp: '0xb77078E1d22F9390441C84ab0C00f656311b224e', rpcs: [process.env.RPC_ETHEREUM_SEPOLIA || 'https://ethereum-sepolia.publicnode.com'] },
  arbitrum: { key: 'arbitrum-sepolia', chainId: 421614, eid: 40243, oapp: '0x3D1D6bc8D8Af01Bff8751b03636c317e3B464b0D', rpcs: [process.env.RPC_ARBITRUM_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc', 'https://arbitrum-sepolia.blockpi.network/v1/rpc/public'] },
  optimism: { key: 'optimism-sepolia', chainId: 11155420, eid: 40232, oapp: '0x005D2E2fcDbA0740725E848cc1bCc019823f118C', rpcs: [process.env.RPC_OPTIMISM_SEPOLIA || 'https://sepolia.optimism.io', 'https://optimism-sepolia.blockpi.network/v1/rpc/public'] },
  base: { key: 'base-sepolia', chainId: 84532, eid: 40245, oapp: '0x68bAB827101cD4C55d9994bc738f2ED8FfAB974F', rpcs: [process.env.RPC_BASE_SEPOLIA || 'https://sepolia.base.org', 'https://base-sepolia.blockpi.network/v1/rpc/public'] },
}

const OAPP_ABI = [
  'function peers(uint32) view returns (bytes32)',
  'function setPeer(uint32 eid, bytes32 peer) external',
]

function toPeerBytes32(addr) {
  const a = addr.toLowerCase().replace(/^0x/, '')
  if (a.length !== 40) throw new Error('Invalid address for peer')
  // bytes32 left-pad: 32 - 20 = 12 bytes => 24 hex zeros
  return '0x' + '0'.repeat(12 * 2) + a
}

async function getProvider(c) {
  for (const url of c.rpcs) {
    try {
      const p = new ethers.JsonRpcProvider(url)
      await p.getBlockNumber()
      return p
    } catch {}
  }
  throw new Error(`No healthy RPC for ${c.key}`)
}

export async function checkPeers() {
  const out = []
  for (const [ui, c] of Object.entries(CHAINS)) {
    const prov = await getProvider(c)
  const oapp = new ethers.Contract(c.oapp, OAPP_ABI, prov)
  const row = { ui, key: c.key, chainId: c.chainId, eid: c.eid, oapp: c.oapp, peers: {} }
    for (const [ui2, d] of Object.entries(CHAINS)) {
      if (ui2 === ui) continue
      try {
    const peer = await oapp.peers(d.eid)
        row.peers[ui2] = peer && peer !== ethers.ZeroHash ? peer : null
      } catch (e) {
        row.peers[ui2] = null
      }
    }
    out.push(row)
  }
  return out
}

export async function setPeer({ from, to, pk }) {
  const src = CHAINS[from]; const dst = CHAINS[to]
  if (!src || !dst) throw new Error('Unknown chain alias')
  const prov = await getProvider(src)
  const raw = (pk || '').trim()
  const normPk = raw ? (raw.startsWith('0x') ? raw : `0x${raw}`) : ''
  if (!normPk || normPk.length < 66) throw new Error('Invalid PRIVATE_KEY')
  const wallet = new ethers.Wallet(normPk, prov)
  const oapp = new ethers.Contract(src.oapp, OAPP_ABI, wallet)
  const peerAddr = dst.oapp
  const tx = await oapp.setPeer(dst.eid, toPeerBytes32(peerAddr))
  const rec = await tx.wait()
  return rec?.hash
}

export function listChains() {
  return Object.entries(CHAINS).map(([ui, c]) => ({ ui, ...c }))
}
