import { getViemClient } from './providerCache'
import { UI_TO_CHAINKEY, ROUTERS, ESCROWS, type ChainKey, LZ_EIDS } from '../config/chains'
import { decodeEventLog, decodeAbiParameters } from 'viem'

export type ReceiptStatus = 'pending' | 'confirmed' | 'failed'

export async function getReceiptStatus(params: { chainId: number; txHash: `0x${string}` }): Promise<{ status: ReceiptStatus; blockNumber?: bigint }>{
  const client = getViemClient(params.chainId)
  try {
    const rec = await client.getTransactionReceipt({ hash: params.txHash })
    if (!rec) return { status: 'pending' }
    const ok = rec.status === 'success'
    return { status: ok ? 'confirmed' : 'failed', blockNumber: rec.blockNumber }
  } catch (e: unknown) {
    // If not found yet
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('not found') || msg.includes('header not found')) return { status: 'pending' }
    throw e
  }
}

export async function checkWiring(params: { fromUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'; toUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base' }): Promise<{
  escrowRouterOk: boolean
  routerPeerOk: boolean
  routerEscrowOk: boolean | null
}> {
  const from = UI_TO_CHAINKEY[params.fromUiKey]
  const to = UI_TO_CHAINKEY[params.toUiKey]
  const fromChainId = CHAIN_IDS[from]
  const client = getViemClient(fromChainId)
  const escrow = ESCROWS[from]
  const router = ROUTERS[from]
  const dstEid = LZ_EIDS[to]
  // ABIs
  const ESCROW_ABI = [ { type: 'function', name: 'router', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] } ] as const
  const ROUTER_ABI = [
    { type: 'function', name: 'peers', stateMutability: 'view', inputs: [{ name: '', type: 'uint32' }], outputs: [{ type: 'bytes32' }] },
    { type: 'function', name: 'escrow', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  ] as const
  const escrowRouter = await client.readContract({ address: escrow, abi: ESCROW_ABI, functionName: 'router' }) as `0x${string}`
  const escrowRouterOk = !!escrowRouter && escrowRouter.toLowerCase() === router.toLowerCase()
  const peer = await client.readContract({ address: router, abi: ROUTER_ABI, functionName: 'peers', args: [dstEid] }) as `0x${string}`
  const routerPeerOk = !!peer && !/^0x0+$/.test(peer)
  let routerEscrowOk: boolean | null = null
  try {
    const routerEscrow = await client.readContract({ address: router, abi: ROUTER_ABI, functionName: 'escrow' }) as `0x${string}`
    routerEscrowOk = !!routerEscrow && routerEscrow.toLowerCase() === escrow.toLowerCase()
  } catch {
    routerEscrowOk = null
  }
  return { escrowRouterOk, routerPeerOk, routerEscrowOk }
}

// Event: V2MessageReceived(uint32 srcEid, bytes payload)
const V2_RECEIVED_TOPIC = '0x1f4df92f3a2bdf9cb68b0a18778043f9c59f8411a8d4c3b9a0a2ed6f22d7f2be' as const

export async function findDelivery(params: {
  toUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  recipient: `0x${string}`
  minBlock?: bigint
  maxLookbackBlocks?: bigint
}): Promise<{ delivered: boolean; matchedLog?: { blockNumber: bigint; txHash: `0x${string}` } }>{
  const to = UI_TO_CHAINKEY[params.toUiKey]
  const dstChainId = CHAIN_IDS[to]
  const router = ROUTERS[to]
  const client = getViemClient(dstChainId)
  const latest = await client.getBlockNumber()
  const fromBlock = params.minBlock && params.minBlock > 0n ? params.minBlock : (latest > 5000n ? latest - 5000n : 0n)
  const start = params.maxLookbackBlocks ? (latest > params.maxLookbackBlocks ? latest - params.maxLookbackBlocks : 0n) : fromBlock
  const logs = await client.getLogs({ address: router, fromBlock: start, toBlock: latest })
  for (const lg of logs) {
    try {
      if (!lg.topics || lg.topics.length === 0) continue
      if ((lg.topics[0] as string)?.toLowerCase() !== V2_RECEIVED_TOPIC) continue
      const decoded = decodeEventLog({
        abi: [ { type: 'event', name: 'V2MessageReceived', inputs: [ { name: 'srcEid', type: 'uint32', indexed: false }, { name: 'payload', type: 'bytes', indexed: false } ] } ] as const,
        data: lg.data as `0x${string}`,
        topics: [lg.topics[0] as `0x${string}`, ...(lg.topics.slice(1) as `0x${string}`[])] as [signature: `0x${string}`, ...args: `0x${string}`[]],
      }) as { eventName: 'V2MessageReceived'; args: { srcEid: number; payload: `0x${string}` } }
      const payload: `0x${string}` = decoded.args.payload
      if (!payload) continue
      // Try to decode as (uint256,address,uint256)
      const [, toAddr] = decodeAbiParameters([ { type: 'uint256' }, { type: 'address' }, { type: 'uint256' } ] as const, payload)
      if (toAddr.toLowerCase() === params.recipient.toLowerCase()) {
        return { delivered: true, matchedLog: { blockNumber: lg.blockNumber!, txHash: lg.transactionHash! as `0x${string}` } }
      }
    } catch {
      continue
    }
  }
  return { delivered: false }
}

// Local map matching CHAIN_IDS used elsewhere
const CHAIN_IDS: Record<ChainKey, number> = {
  'ethereum-sepolia': 11155111,
  'arbitrum-sepolia': 421614,
  'optimism-sepolia': 11155420,
  'base-sepolia': 84532,
}
