// Pure viem provider cache (removed ethers JsonRpcProvider)
import { createPublicClient, http, PublicClient } from 'viem'
import CONTRACTS from '../../services/contracts'
import type { ContractsEntry } from '../../types/contracts'

type Cached = { client: PublicClient; url: string; ts: number }
const providers: Record<number, Cached> = {}
const viemClients: Record<number, { client: PublicClient; url: string; ts: number }> = {}
const fallbackLogged: Record<number, boolean> = {}

function knownDefaults(chainId: number): string[] {
  switch (chainId) {
    case 11155111: // Ethereum Sepolia
      return [
        import.meta.env?.VITE_RPC_ETHEREUM_SEPOLIA,
      ].filter(Boolean) as string[]
    case 421614: // Arbitrum Sepolia
      return [
        import.meta.env?.VITE_RPC_ARBITRUM_SEPOLIA,
      ].filter(Boolean) as string[]
    case 11155420: // Optimism Sepolia
      return [
        import.meta.env?.VITE_RPC_OPTIMISM_SEPOLIA,
      ].filter(Boolean) as string[]
    case 84532: // Base Sepolia
      return [
        import.meta.env?.VITE_RPC_BASE_SEPOLIA,
      ].filter(Boolean) as string[]
    default:
      return []
  }
}

export function mergeRpcUrls(main: string[], extras: string[], defaults: string[]): string[] {
  // Normalize: trim and drop blanks/whitespace-only
  const combined = [...main, ...extras, ...defaults]
    .map(u => (typeof u === 'string' ? u.trim() : u))
    .filter(u => !!u)
  // Deduplicate while preserving first occurrence
  const seen = new Set<string>()
  const urls = combined.filter(u => (!seen.has(u) ? (seen.add(u), true) : false))
  if (!urls.length) {
    throw new Error('No RPC URLs provided (main, extras, defaults all empty)')
  }
  return urls
}

function listRpcUrls(chainId: number): string[] {
  const entry = (CONTRACTS as Record<number, Partial<Pick<ContractsEntry,'rpc'>>>)[chainId]
  const main = entry?.rpc ? [entry.rpc as string] : []
  // Allow comma-separated fallbacks via VITE_RPC_<CHAIN>_FALLBACKS
  const envListVar = (() => {
    switch (chainId) {
  case 11155111: return import.meta.env?.VITE_RPC_ETHEREUM_SEPOLIA_FALLBACKS
  case 421614: return import.meta.env?.VITE_RPC_ARBITRUM_SEPOLIA_FALLBACKS
  case 11155420: return import.meta.env?.VITE_RPC_OPTIMISM_SEPOLIA_FALLBACKS
  case 84532: return import.meta.env?.VITE_RPC_BASE_SEPOLIA_FALLBACKS
      default: return undefined
    }
  })()
  const extras = (envListVar ? String(envListVar).split(',').map(s => s.trim()).filter(Boolean) : [])
  const defaults = knownDefaults(chainId)
  try {
    return mergeRpcUrls(main, extras, defaults)
  } catch {
    throw new Error(`Missing RPC URL for chain ${chainId}. Please set VITE_RPC_* in .env (e.g., VITE_RPC_ETHEREUM_SEPOLIA).`)
  }
}

// Public helper to surface the candidate RPC list (ordered, de-duped) for diagnostics / UI.
export function listRpcCandidates(chainId: number): string[] {
  try {
    return listRpcUrls(chainId)
  } catch {
    return []
  }
}

async function pickFastestProvider(chainId: number, timeoutMs = 2500): Promise<Cached> {
  const urls = listRpcUrls(chainId)
  if (!urls.length) throw new Error(`Missing RPC for chain ${chainId}`)
  // Race getBlockNumber via viem public clients
  const attempts = urls.map(url => new Promise<Cached>((resolve, reject) => {
    const client = createPublicClient({ transport: http(url) })
    const to = setTimeout(() => reject(new Error(`timeout: ${url}`)), timeoutMs)
    client.getBlockNumber().then(() => { clearTimeout(to); resolve({ client, url, ts: Date.now() }) }).catch(err => { clearTimeout(to); reject(err) })
  }))
  // Use the first to succeed (manual any)
  const winner = await new Promise<Cached | null>((resolve) => {
    let settled = false
    let pending = attempts.length
    attempts.forEach(p => p.then(val => { if (!settled) { settled = true; resolve(val) } }).catch(() => {
      pending -= 1
      if (!settled && pending === 0) resolve(null)
    }))
  })
  if (!winner) {
    // Fall back to first URL even if health checks failed (let retries handle later)
  const picked = { client: createPublicClient({ transport: http(urls[0]) }), url: urls[0], ts: Date.now() }
    if (typeof window !== 'undefined' && !fallbackLogged[chainId]) {
      // Log only once per chain per session
      console.warn(`[rpc] chain ${chainId}: all probe attempts failed, using first URL fallback: ${urls[0]}`)
      fallbackLogged[chainId] = true
    }
    return picked
  }
  // If the fastest winner is not the first candidate, log it once (observability)
  if (typeof window !== 'undefined' && winner.url !== urls[0] && !fallbackLogged[chainId]) {
    console.info(`[rpc] chain ${chainId}: selected fallback provider ${winner.url} (primary was ${urls[0]})`)
    fallbackLogged[chainId] = true
  }
  return winner
}

export async function refreshProvider(chainId: number): Promise<PublicClient> {
  const picked = await pickFastestProvider(chainId)
  providers[chainId] = picked
  viemClients[chainId] = { client: picked.client, url: picked.url, ts: picked.ts }
  return picked.client
}

export function getCachedProvider(chainId: number): PublicClient {
  const cached = providers[chainId]
  const needsRefresh = !cached || (Date.now() - cached.ts > 10 * 60 * 1000)
  if (needsRefresh) {
    pickFastestProvider(chainId).then(p => { providers[chainId] = p; viemClients[chainId] = { client: p.client, url: p.url, ts: p.ts } }).catch(() => {})
    if (cached) return cached.client
    const url = listRpcUrls(chainId)[0]
    const client = createPublicClient({ transport: http(url) })
    providers[chainId] = { client, url, ts: Date.now() }
    viemClients[chainId] = { client, url, ts: Date.now() }
    return client
  }
  return cached.client
}

export function getViemClient(chainId: number): PublicClient { return getCachedProvider(chainId) }

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: number
  const timeout = new Promise<never>((_, reject) => { t = window.setTimeout(() => reject(new Error('timeout')), ms) })
  return Promise.race([p, timeout]).finally(() => window.clearTimeout(t))
}

export async function withRetries<T>(fn: () => Promise<T>, opts?: { retries?: number; baseDelayMs?: number; timeoutMs?: number }): Promise<T> {
  const retries = opts?.retries ?? 2
  const base = opts?.baseDelayMs ?? 250
  const toMs = opts?.timeoutMs ?? 5000
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await withTimeout(fn(), toMs)
    } catch (e) {
      lastErr = e
      if (i === retries) break
      const jitter = Math.floor(Math.random() * 120)
      await new Promise(r => setTimeout(r, base * (i + 1) + jitter))
    }
  }
  throw lastErr as Error
}
