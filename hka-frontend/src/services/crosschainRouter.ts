// Removed broad ethers usage; only need zero hash constant for peer checks
const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'
// viem ABI encoder to replace ethers.AbiCoder for static payload encoding (migration step 1)
import { encodeAbiParameters } from 'viem'
import { ROUTERS, UI_TO_CHAINKEY, type ChainKey } from '../config/chains'
import { buildLzV2OptionsLzReceiveGas } from '../utils/lzOptions'
import CONTRACTS from '../../services/contracts'
import type { ContractsEntry } from '../../types/contracts'
import { getCachedProvider, withRetries, getViemClient } from './providerCache'

// Minimal ABI for our OAppRouterV2 (as implemented in fractal-backend)
// - quote(dstEid, payload, options) returns a struct (nativeFee, lzTokenFee)
// - sendSwapMessage(dstEid, payload, options) payable
// NOTE: Removed ROUTER_ABI usage in favor of inline viem ABIs per call.

type QuoteResult = {
  nativeFee: string
  lzTokenFee: string
}

type RouteQuote = QuoteResult & {
  route: 'direct' | 'multihop'
  legs?: Array<{ from: ChainKey; to: ChainKey; nativeFee: string; lzTokenFee: string }>
}

// Map UI keys to chain metadata
const CHAIN_IDS: Record<ChainKey, number> = {
  'ethereum-sepolia': 11155111,
  'arbitrum-sepolia': 421614,
  'optimism-sepolia': 11155420,
  'base-sepolia': 84532,
}

function getChainId(chainKey: ChainKey): number {
  return CHAIN_IDS[chainKey]
}

function getRouterAddress(chainKey: ChainKey): `0x${string}` {
  return ROUTERS[chainKey]
}

function getEid(chainKey: ChainKey): number {
  const chainId = CHAIN_IDS[chainKey]
  const entry = (CONTRACTS as Record<number, Pick<ContractsEntry,'layerZeroEid'>>)[chainId]
  const eid = entry?.layerZeroEid
  if (!eid) throw new Error(`Missing LayerZero EID for ${chainKey}`)
  return eid as number
}

// Encode a lightweight payload to approximate real message size for fee calc
function encodePayload(params: {
  user?: `0x${string}`
  fromToken: string
  toToken: string
  amount: bigint
}): `0x${string}` {
  const { user = '0x0000000000000000000000000000000000000000', fromToken, toToken, amount } = params
  // Replaced ethers.AbiCoder with viem encodeAbiParameters for tree-shakable ABI encoding.
  const encoded = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'string' },
      { type: 'string' },
      { type: 'uint256' },
    ],
    [user, fromToken, toToken, amount]
  )
  return encoded as `0x${string}`
}

// Encode the real execution payload expected by OAppRouterV2.lzReceive: (uint256 id, address to, uint256 minOut)
// (execute payload encoding now lives only in dynamic send module)

async function quoteOnce(src: ChainKey, dst: ChainKey, payloadSizeHint?: `0x${string}`): Promise<QuoteResult> {
  const options = buildLzV2OptionsLzReceiveGas(250_000n)
  const message = payloadSizeHint ?? encodePayload({ fromToken: 'ETH', toToken: 'ETH', amount: 1n })
  const client = getViemClient(getChainId(src))
  const [nativeFee, lzTokenFee] = await withRetries(
    () => client.readContract({
      address: getRouterAddress(src),
      abi: [
        { type: 'function', name: 'quote', stateMutability: 'view', inputs: [
          { name: 'dstEid', type: 'uint32' },
          { name: 'payload', type: 'bytes' },
          { name: 'options', type: 'bytes' },
        ], outputs: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' }
        ] }
      ] as const,
      functionName: 'quote',
  args: [getEid(dst), message as `0x${string}`, options as `0x${string}`]
    }) as Promise<[bigint, bigint]>,
    { timeoutMs: 7000, retries: 3 }
  )
  return { nativeFee: nativeFee.toString(), lzTokenFee: lzTokenFee.toString() }
}

// Lightweight cache to avoid repeated identical quotes within a short window
const QUOTE_CACHE = new Map<string, { data: RouteQuote; ts: number }>()
const QUOTE_TTL_MS = 8000

function cacheKey(params: { from: ChainKey; to: ChainKey; fromToken: string; toToken: string; amount: bigint; user?: string }) {
  return `${params.from}|${params.to}|${params.fromToken}|${params.toToken}|${params.amount}|${params.user ?? '0x0'}`
}

export async function quoteRoute(params: {
  fromUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  toUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  fromToken: string
  toToken: string
  amount: bigint
  user?: `0x${string}`
}): Promise<RouteQuote> {
  const from = UI_TO_CHAINKEY[params.fromUiKey]
  const to = UI_TO_CHAINKEY[params.toUiKey]
  const payload = encodePayload({ user: params.user, fromToken: params.fromToken, toToken: params.toToken, amount: params.amount })
  const key = cacheKey({ from, to, fromToken: params.fromToken, toToken: params.toToken, amount: params.amount, user: params.user })
  const cached = QUOTE_CACHE.get(key)
  const now = Date.now()
  if (cached && now - cached.ts < QUOTE_TTL_MS) {
    return cached.data
  }
  // Strategy: compute both direct and multihop (via ethereum-sepolia) and choose the cheaper when possible.
  const hop: ChainKey = 'ethereum-sepolia'
  const wantMultihop = from !== hop && to !== hop

  // Fire both options in parallel; tolerate failures and pick the viable/better one.
  const directP = quoteOnce(from, to, payload).then(q => ({ ok: true as const, q })).catch(e => ({ ok: false as const, e }))
  const multihopP = wantMultihop
    ? Promise.all([quoteOnce(from, hop, payload), quoteOnce(hop, to, payload)])
        .then(([leg1, leg2]) => {
          const sumNative = (BigInt(leg1.nativeFee) + BigInt(leg2.nativeFee)).toString()
          const sumLz = (BigInt(leg1.lzTokenFee) + BigInt(leg2.lzTokenFee)).toString()
          const data: RouteQuote = {
            route: 'multihop',
            nativeFee: sumNative,
            lzTokenFee: sumLz,
            legs: [
              { from, to: hop, nativeFee: leg1.nativeFee, lzTokenFee: leg1.lzTokenFee },
              { from: hop, to, nativeFee: leg2.nativeFee, lzTokenFee: leg2.lzTokenFee },
            ],
          }
          return { ok: true as const, q: data }
        })
        .catch(e => ({ ok: false as const, e }))
    : Promise.resolve({ ok: false as const, e: new Error('multihop not applicable') })

  const [directRes, multihopRes] = await Promise.all([directP, multihopP])

  function totalFeeWei(x: { nativeFee: string; lzTokenFee: string }) {
    return BigInt(x.nativeFee) + BigInt(x.lzTokenFee)
  }

  let data: RouteQuote
  if (directRes.ok && multihopRes.ok) {
    // Pick the cheaper route by total fee (native + lzToken); ties prefer direct for simplicity
    const d: RouteQuote = { route: 'direct', ...directRes.q } as RouteQuote
    const m: RouteQuote = multihopRes.q
    data = totalFeeWei(d) <= totalFeeWei(m) ? d : m
  } else if (directRes.ok) {
    data = { route: 'direct', ...directRes.q } as RouteQuote
  } else if (multihopRes.ok) {
    data = multihopRes.q
  } else {
    // Both failed; bubble up direct error
    throw (directRes as { e: unknown }).e
  }

  QUOTE_CACHE.set(key, { data, ts: now })
  return data
}

// -------- Route health check (detect unsupported pairs) ---------
const ROUTE_HEALTH_CACHE = new Map<string, { ok: boolean; ts: number; err?: string }>()
// Keep short so UI reflects newly wired peers quickly
const ROUTE_HEALTH_TTL_MS = 60 * 1000

export async function isRouteSupported(fromUi: 'ethereum' | 'arbitrum' | 'optimism' | 'base', toUi: 'ethereum' | 'arbitrum' | 'optimism' | 'base'): Promise<{ ok: boolean; reason?: string }> {
  const from = UI_TO_CHAINKEY[fromUi]
  const to = UI_TO_CHAINKEY[toUi]
  const key = `${from}|${to}`
  const now = Date.now()
  const cached = ROUTE_HEALTH_CACHE.get(key)
  if (cached && now - cached.ts < ROUTE_HEALTH_TTL_MS) {
    return { ok: cached.ok, reason: cached.err }
  }
  try {
    // First, optimistic readiness check: code+peer means route should be supported, even if quote times out.
  const srcClient = getCachedProvider(getChainId(from))
  const code = await (srcClient as { transport: { request: (args: { method: string; params: unknown[] }) => Promise<string> } }).transport.request({ method: 'eth_getCode', params: [getRouterAddress(from), 'latest'] })
    const hasCode = !!code && code !== '0x'
    const dstEid = getEid(to)
    const client = getViemClient(getChainId(from))
    const peer = await withRetries(() => client.readContract({
      address: getRouterAddress(from),
      abi: [{ type: 'function', name: 'peers', stateMutability: 'view', inputs: [{ name: '', type: 'uint32' }], outputs: [{ type: 'bytes32' }] }] as const,
      functionName: 'peers',
      args: [dstEid]
    }) as Promise<`0x${string}`>, { timeoutMs: 3000, retries: 1 })
  const peerSet = peer && peer !== ZERO_HASH
    if (hasCode && peerSet) {
      ROUTE_HEALTH_CACHE.set(key, { ok: true, ts: now })
      return { ok: true }
    }
    // As a secondary check, try a tiny quote to see if path is active.
    await quoteOnce(from, to, encodePayload({ fromToken: 'ETH', toToken: 'ETH', amount: 1n }))
    ROUTE_HEALTH_CACHE.set(key, { ok: true, ts: now })
    return { ok: true }
  } catch (e: unknown) {
    const err = e as { shortMessage?: string; message?: string }
    const directMsg = (err?.shortMessage || err?.message || 'direct quote failed') as string
    // If direct failed, but router is deployed and peer is set, treat as supported
    try {
  const srcClient = getCachedProvider(getChainId(from))
  const code = await (srcClient as { transport: { request: (args: { method: string; params: unknown[] }) => Promise<string> } }).transport.request({ method: 'eth_getCode', params: [getRouterAddress(from), 'latest'] })
      const hasCode = !!code && code !== '0x'
      const dstEid = getEid(to)
      const client = getViemClient(getChainId(from))
      const peer = await withRetries(() => client.readContract({
        address: getRouterAddress(from),
        abi: [{ type: 'function', name: 'peers', stateMutability: 'view', inputs: [{ name: '', type: 'uint32' }], outputs: [{ type: 'bytes32' }] }] as const,
        functionName: 'peers',
        args: [dstEid]
      }) as Promise<`0x${string}`>, { timeoutMs: 3000, retries: 1 })
  const peerSet = peer && peer !== ZERO_HASH
      if (hasCode && peerSet) {
        ROUTE_HEALTH_CACHE.set(key, { ok: true, ts: now })
        return { ok: true }
      }
    } catch {
      // ignore peer readiness probe errors
    }
    // Check multihop via Ethereum and diagnose failing leg
    const hop: ChainKey = 'ethereum-sepolia'
    if (from !== hop && to !== hop) {
      const payload = encodePayload({ fromToken: 'ETH', toToken: 'ETH', amount: 1n })
      let leg1Ok = false
      let leg2Ok = false
      let leg1Err: string | undefined
      let leg2Err: string | undefined
      try {
        await quoteOnce(from, hop, payload)
        leg1Ok = true
      } catch (e1: unknown) {
        const e1m = e1 as { shortMessage?: string; message?: string }
        leg1Err = e1m?.shortMessage || e1m?.message || 'leg from→ETH failed'
      }
      try {
        await quoteOnce(hop, to, payload)
        leg2Ok = true
      } catch (e2: unknown) {
        const e2m = e2 as { shortMessage?: string; message?: string }
        leg2Err = e2m?.shortMessage || e2m?.message || 'leg ETH→to failed'
      }
      if (leg1Ok && leg2Ok) {
        ROUTE_HEALTH_CACHE.set(key, { ok: true, ts: now })
        return { ok: true }
      }
      // If legs failed, but routers are deployed and peers are set along both legs, treat as supported
      try {
  const srcClientAgain = getCachedProvider(getChainId(from))
  const hopClientCached = getCachedProvider(getChainId(hop))
  const codeSrc = await (srcClientAgain as { transport: { request: (args: { method: string; params: unknown[] }) => Promise<string> } }).transport.request({ method: 'eth_getCode', params: [getRouterAddress(from), 'latest'] })
  const codeHop = await (hopClientCached as { transport: { request: (args: { method: string; params: unknown[] }) => Promise<string> } }).transport.request({ method: 'eth_getCode', params: [getRouterAddress(hop), 'latest'] })
        const hasCodeSrc = !!codeSrc && codeSrc !== '0x'
        const hasCodeHop = !!codeHop && codeHop !== '0x'
        const srcClient = getViemClient(getChainId(from))
        const hopClient = getViemClient(getChainId(hop))
        const peerSrcToHop = await withRetries(() => srcClient.readContract({
          address: getRouterAddress(from), abi: [{ type: 'function', name: 'peers', stateMutability: 'view', inputs: [{ type: 'uint32' }], outputs: [{ type: 'bytes32' }] }] as const, functionName: 'peers', args: [getEid(hop)]
        }) as Promise<`0x${string}`>, { timeoutMs: 3000, retries: 1 })
        const peerHopToDst = await withRetries(() => hopClient.readContract({
          address: getRouterAddress(hop), abi: [{ type: 'function', name: 'peers', stateMutability: 'view', inputs: [{ type: 'uint32' }], outputs: [{ type: 'bytes32' }] }] as const, functionName: 'peers', args: [getEid(to)]
        }) as Promise<`0x${string}`>, { timeoutMs: 3000, retries: 1 })
  const okPeers = peerSrcToHop && peerSrcToHop !== ZERO_HASH && peerHopToDst && peerHopToDst !== ZERO_HASH
        if (hasCodeSrc && hasCodeHop && okPeers) {
          ROUTE_HEALTH_CACHE.set(key, { ok: true, ts: now })
          return { ok: true }
        }
      } catch {
        // ignore code/peer probe errors on multihop diagnosis
      }
      const reason = !leg1Ok ? `route probe failed on ${from}→ethereum: ${leg1Err}` : `route probe failed on ethereum→${to}: ${leg2Err}`
      ROUTE_HEALTH_CACHE.set(key, { ok: false, ts: now, err: reason })
      return { ok: false, reason }
    }
  // from or to is the hop (ethereum-sepolia). We already attempted code+peer check above; if it didn't pass, bubble the direct message.
    ROUTE_HEALTH_CACHE.set(key, { ok: false, ts: now, err: directMsg })
    return { ok: false, reason: directMsg }
  }
}

import { formatUnits } from '../../services/viemAdapter'

export function formatFeeWeiToEth(wei: string): string {
  try {
    const as = formatUnits(BigInt(wei), 18)
    return Number(as).toFixed(6)
  } catch {
    return '0.000000'
  }
}

// --- Sending helpers ---
// Wallet switching & signing kept only in dynamic module.

// Lazy loaders for send/cancel to keep initial bundle free of signer logic
export async function sendRouteLazy(params: {
  fromUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  toUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  fromToken: string
  toToken: string
  amount: bigint
  user?: `0x${string}`
  minOut?: bigint
  debug?: (info: { attempt: number; phase: 'quote' | 'simulate' | 'send' | 'error' | 'done'; feeWei: bigint; optionsGas: bigint; message?: string }) => void
}) {
  const mod = await import('./crosschainSend')
  return mod.sendRoute(params)
}
export async function cancelOrderLazy(params: { fromUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'; orderId: bigint }) {
  const mod = await import('./crosschainSend')
  return mod.cancelOrder(params)
}
