import { JsonRpcProvider } from 'ethers'
import CONTRACTS from '../../services/contracts'

type Cached = { provider: JsonRpcProvider; url: string; ts: number }
const providers: Record<number, Cached> = {}

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

function listRpcUrls(chainId: number): string[] {
  const entry = (CONTRACTS as Record<number, { rpc?: string }>)[chainId]
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
  // Deduplicate while preserving order
  const seen = new Set<string>()
  const urls = [...main, ...extras, ...defaults].filter(u => (u && !seen.has(u) ? (seen.add(u), true) : false))
  if (!urls.length) {
    throw new Error(`Missing RPC URL for chain ${chainId}. Please set VITE_RPC_* in .env (e.g., VITE_RPC_ETHEREUM_SEPOLIA).`)
  }
  return urls
}

async function pickFastestProvider(chainId: number, timeoutMs = 2500): Promise<Cached> {
  const urls = listRpcUrls(chainId)
  if (!urls.length) throw new Error(`Missing RPC for chain ${chainId}`)
  // Race a lightweight getBlockNumber across providers with a timeout
  const attempts = urls.map(url => new Promise<Cached>((resolve, reject) => {
    const prov = new JsonRpcProvider(url)
    const to = setTimeout(() => reject(new Error(`timeout: ${url}`)), timeoutMs)
    prov.getBlockNumber().then(() => { clearTimeout(to); resolve({ provider: prov, url, ts: Date.now() }) }).catch(err => { clearTimeout(to); reject(err) })
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
  return { provider: new JsonRpcProvider(urls[0]), url: urls[0], ts: Date.now() }
  }
  return winner
}

export async function refreshProvider(chainId: number): Promise<JsonRpcProvider> {
  const picked = await pickFastestProvider(chainId)
  providers[chainId] = picked
  return picked.provider
}

export function getCachedProvider(chainId: number): JsonRpcProvider {
  const cached = providers[chainId]
  // Re-pick provider every ~10 minutes to adapt to changing network conditions
  const needsRefresh = !cached || (Date.now() - cached.ts > 10 * 60 * 1000)
  if (needsRefresh) {
    // Start background refresh, return immediate best-effort provider
    pickFastestProvider(chainId).then(p => { providers[chainId] = p }).catch(() => { /* keep old */ })
    return cached?.provider || new JsonRpcProvider(listRpcUrls(chainId)[0])
  }
  return cached.provider
}

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
