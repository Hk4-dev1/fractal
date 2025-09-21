import { ethers } from 'ethers'
import { ROUTERS, UI_TO_CHAINKEY, ESCROWS, type ChainKey } from '../config/chains'
import { buildLzV2OptionsLzReceiveGas } from '../utils/lzOptions'
import CONTRACTS from '../../services/contracts'
import { getCachedProvider, withRetries } from './providerCache'

// Minimal ABI for our OAppRouterV2 (as implemented in fractal-backend)
// - quote(dstEid, payload, options) returns a struct (nativeFee, lzTokenFee)
// - sendSwapMessage(dstEid, payload, options) payable
const ROUTER_ABI = [
  'function quote(uint32 dstEid, bytes payload, bytes options) view returns (uint256 nativeFee, uint256 lzTokenFee)',
  'function sendSwapMessage(uint32 dstEid, bytes payload, bytes options) payable',
  'function peers(uint32) view returns (bytes32)'
]

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
  const entry = (CONTRACTS as Record<number, { layerZeroEid?: number }>)[chainId]
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
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'string', 'string', 'uint256'],
    [user, fromToken, toToken, amount],
  )
  return encoded as `0x${string}`
}

// Encode the real execution payload expected by OAppRouterV2.lzReceive: (uint256 id, address to, uint256 minOut)
function encodeExecutePayload(id: bigint, to: `0x${string}`, minOut: bigint): `0x${string}` {
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'address', 'uint256'],
    [id, to, minOut],
  )
  return encoded as `0x${string}`
}

async function quoteOnce(src: ChainKey, dst: ChainKey, payloadSizeHint?: `0x${string}`): Promise<QuoteResult> {
  const provider = getCachedProvider(getChainId(src))
  const router = new ethers.Contract(getRouterAddress(src), ROUTER_ABI, provider)
  const options = buildLzV2OptionsLzReceiveGas(250_000n)
  const message = payloadSizeHint ?? encodePayload({ fromToken: 'ETH', toToken: 'ETH', amount: 1n })
  const [nativeFee, lzTokenFee] = await withRetries(
    () => router.quote(getEid(dst), message, options),
    // Bump timeout/retries to better tolerate testnet RPC slowness
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
    const srcProvider = getCachedProvider(getChainId(from))
    const router = new ethers.Contract(getRouterAddress(from), ROUTER_ABI, srcProvider)
    const code = await srcProvider.getCode(getRouterAddress(from))
    const hasCode = !!code && code !== '0x'
    const dstEid = getEid(to)
    const peer: string = await withRetries(() => router.peers(dstEid), { timeoutMs: 3000, retries: 1 })
    const peerSet = peer && peer !== ethers.ZeroHash
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
      const srcProvider = getCachedProvider(getChainId(from))
      const router = new ethers.Contract(getRouterAddress(from), ROUTER_ABI, srcProvider)
      const code = await srcProvider.getCode(getRouterAddress(from))
      const hasCode = !!code && code !== '0x'
      const dstEid = getEid(to)
      const peer: string = await withRetries(() => router.peers(dstEid), { timeoutMs: 3000, retries: 1 })
      const peerSet = peer && peer !== ethers.ZeroHash
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
        const srcProvider = getCachedProvider(getChainId(from))
        const hopProvider = getCachedProvider(getChainId(hop))
        const srcRouter = new ethers.Contract(getRouterAddress(from), ROUTER_ABI, srcProvider)
        const hopRouter = new ethers.Contract(getRouterAddress(hop), ROUTER_ABI, hopProvider)
        const codeSrc = await srcProvider.getCode(getRouterAddress(from))
        const codeHop = await hopProvider.getCode(getRouterAddress(hop))
        const hasCodeSrc = !!codeSrc && codeSrc !== '0x'
        const hasCodeHop = !!codeHop && codeHop !== '0x'
        const peerSrcToHop: string = await withRetries(() => srcRouter.peers(getEid(hop)), { timeoutMs: 3000, retries: 1 })
        const peerHopToDst: string = await withRetries(() => hopRouter.peers(getEid(to)), { timeoutMs: 3000, retries: 1 })
        const okPeers = peerSrcToHop && peerSrcToHop !== ethers.ZeroHash && peerHopToDst && peerHopToDst !== ethers.ZeroHash
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

export function formatFeeWeiToEth(wei: string): string {
  try {
    return Number(ethers.formatEther(wei)).toFixed(6)
  } catch {
    return '0.000000'
  }
}

// --- Sending helpers ---
async function switchWalletTo(chainKey: ChainKey) {
  const chainId = CHAIN_IDS[chainKey]
  const w = window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
  if (!w?.ethereum) throw new Error('Wallet not found')
  try {
    await w.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    })
  } catch (err: unknown) {
    // If chain not added (4902), try to add using CONTRACTS rpc
    const e = err as { code?: number }
    if (e?.code === 4902) {
      const entry = (CONTRACTS as Record<number, { name?: string; rpc?: string; explorer?: string }>)[chainId]
  await w.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${chainId.toString(16)}`,
          chainName: entry?.name || chainKey,
          rpcUrls: [entry?.rpc],
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          blockExplorerUrls: entry?.explorer ? [entry.explorer] : [],
        }],
      })
    } else {
      throw err
    }
  }
}

import type { Eip1193Provider } from 'ethers'

async function getSignerOn(chainKey: ChainKey) {
  await switchWalletTo(chainKey)
  const w = window as unknown as { ethereum?: Eip1193Provider }
  const provider = new ethers.BrowserProvider(w.ethereum as Eip1193Provider)
  const signer = await provider.getSigner()
  // Simple sanity: ensure network matches expected
  const net = await provider.getNetwork()
  const expected = BigInt(CHAIN_IDS[chainKey])
  if (net.chainId !== expected) throw new Error(`Wrong network: ${net.chainId} != ${expected}`)
  return { provider, signer }
}

// sendOnce() no longer used; dispatch is performed by EscrowCore to satisfy router authorization.

export async function sendRoute(params: {
  fromUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  toUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  fromToken: string
  toToken: string
  amount: bigint
  user?: `0x${string}`
}): Promise<{ route: 'direct'; txHash: string; orderId: string } | { route: 'multihop'; leg1: string; leg2: string; orderId: string }> {
  const from = UI_TO_CHAINKEY[params.fromUiKey]
  const to = UI_TO_CHAINKEY[params.toUiKey]
  // For fee estimation we use a size-hint payload elsewhere; here we prepare execution payload instead
  // 1) Move funds into Escrow on source chain to avoid "0 amount" issues on-chain
  // Minimal EscrowCore ABI
  const ESCROW_ABI = [
    'event OrderCreated(uint256 indexed id, address indexed maker, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint64 dstEid)',
    'function nextOrderId() view returns (uint256)',
    'function createOrder(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid) payable returns (uint256)'
  ]
  function resolveTokenAddress(chainId: number, symbol: string): `0x${string}` | null {
    const entry = (CONTRACTS as Record<number, any>)[chainId]
    if (!entry) return null
    const s = symbol.toUpperCase()
    if (s === 'ETH') return '0x0000000000000000000000000000000000000000'
    if (s === 'WETH') return (entry.weth as `0x${string}`) || null
    if (s === 'USDC') return (entry.testUSDC as `0x${string}`) || null
    if (s === 'TESTETH') return (entry.testETH as `0x${string}`) || null
    return null
  }
  async function createOrderOnEscrow(): Promise<bigint> {
    const { signer } = await getSignerOn(from)
    const chainId = getChainId(from)
    const escrowAddr = ESCROWS[from]
    const escrow = new ethers.Contract(escrowAddr, ESCROW_ABI, signer)
    const iface = new ethers.Interface(ESCROW_ABI)
    const tokenInAddr = resolveTokenAddress(chainId, params.fromToken)
    const tokenOutAddr = resolveTokenAddress(getChainId(to), params.toToken) || '0x0000000000000000000000000000000000000000'
    const minOut = 0n // UI already enforces slippage; on-chain min set to 0 for demo
    if (!tokenInAddr) throw new Error(`Unknown token ${params.fromToken} on ${from}`)
    // If ERC20, ensure allowance and then call createOrder without value
    if (tokenInAddr !== '0x0000000000000000000000000000000000000000') {
      const erc20 = new ethers.Contract(tokenInAddr, ['function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)'], signer)
      const owner = await signer.getAddress()
      const allowance: bigint = await erc20.allowance(owner, escrowAddr)
      if (allowance < params.amount) {
        const txa = await erc20.approve(escrowAddr, params.amount)
        await txa.wait()
      }
      const tx = await escrow.createOrder(tokenInAddr, tokenOutAddr, params.amount, minOut, BigInt(getEid(to)))
      const rec = await tx.wait()
      // Parse OrderCreated(id, maker, ...)
      for (const lg of rec.logs) {
        if (lg.address.toLowerCase() !== escrowAddr.toLowerCase()) continue
        try {
          const parsed = iface.parseLog(lg)
          if (parsed?.name === 'OrderCreated') {
            return parsed.args.id as bigint
          }
        } catch { /* skip non-matching logs */ }
      }
    } else {
      // Native ETH: pass amount as msg.value
      const tx = await escrow.createOrder(tokenInAddr, tokenOutAddr, params.amount, minOut, BigInt(getEid(to)), { value: params.amount })
      const rec = await tx.wait()
      for (const lg of rec.logs) {
        if (lg.address.toLowerCase() !== escrowAddr.toLowerCase()) continue
        try {
          const parsed = iface.parseLog(lg)
          if (parsed?.name === 'OrderCreated') {
            return parsed.args.id as bigint
          }
        } catch { /* skip */ }
      }
    }
    // Fallback: nextOrderId - 1 (should rarely be needed)
    const next: bigint = await escrow.nextOrderId()
    return next - 1n
  }
  // Create order first to actually move the user's funds into escrow on source and get its id
  const orderId = await createOrderOnEscrow()
  const { signer } = await getSignerOn(from)
  const recipient = (params.user as `0x${string}`) || (await signer.getAddress() as `0x${string}`)
  // Encode options (Type-3 gas) matching our Router usage
  const options = buildLzV2OptionsLzReceiveGas(250_000n)
  // Call escrow.dispatchToDst so msg.sender == escrow when router.sendSwapMessage is executed
  const escrowAddr = ESCROWS[from]
  const escrow = new ethers.Contract(escrowAddr, [
    'function dispatchToDst(uint256 id,address to,uint256 minAmountOut,bytes options) payable'
  ], signer)
  // Fresh fee quote for the route (native fee) to supply as msg.value
  const router = new ethers.Contract(getRouterAddress(from), ROUTER_ABI, signer)
  const [nativeFee] = await router.quote(getEid(to), encodeExecutePayload(orderId, recipient, 0n), options)
  const tx = await escrow.dispatchToDst(orderId, recipient, 0n, options, { value: nativeFee })
  const rec = await tx.wait()
  return { route: 'direct', txHash: rec.hash, orderId: orderId.toString() }
}

// Allow user to cancel a pending order on the source chain (refunds net amount; fees already routed)
export async function cancelOrder(params: {
  fromUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  orderId: bigint
}): Promise<string> {
  const from = UI_TO_CHAINKEY[params.fromUiKey]
  const { signer } = await getSignerOn(from)
  const escrowAddr = ESCROWS[from]
  const escrow = new ethers.Contract(escrowAddr, ['function cancelOrder(uint256 id)'], signer)
  const tx = await escrow.cancelOrder(params.orderId)
  const rec = await tx.wait()
  return rec.hash
}
