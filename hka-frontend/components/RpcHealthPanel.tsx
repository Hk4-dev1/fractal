import { useEffect, useState, useCallback } from 'react'
import { listRpcCandidates } from '../src/services/providerCache'
import { createPublicClient, http } from 'viem'
import CONTRACTS, { getSupportedChains } from '../services/contracts'
import type { ContractsEntry } from '../types/contracts'

type RpcStat = {
  chainId: number
  name: string
  url: string
  latencyMs?: number
  ok: boolean
  error?: string
}

// Measure a single RPC latency via getBlockNumber (cached by node but still a round-trip)
async function measure(url: string, timeoutMs = 3500): Promise<{ latency: number }> {
  const start = performance.now()
  const client = createPublicClient({ transport: http(url) })
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), timeoutMs)
  // Using getBlockNumber via public client. Abort just cancels fetch; we translate to timeout.
  try {
    await client.getBlockNumber()
  } catch (err) {
    if (ctrl.signal.aborted) throw new Error('timeout')
    throw err as Error
  } finally {
    clearTimeout(to)
  }
  return { latency: Math.round(performance.now() - start) }
}

export function RpcHealthPanel() {
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState<RpcStat[]>([])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && (e.metaKey || e.ctrlKey)) {
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const run = useCallback(async () => {
    if (running) return
    setRunning(true)
    const chains = getSupportedChains()
    const out: RpcStat[] = []
    for (const cid of chains) {
  const entry = (CONTRACTS as Record<number, Partial<Pick<ContractsEntry,'name'>>>)[cid] || {}
      const list = listRpcCandidates(cid)
      for (const url of list) {
        try {
          const { latency } = await measure(url)
          out.push({ chainId: cid, name: entry.name || String(cid), url, latencyMs: latency, ok: true })
        } catch (err) {
          const e = err as { message?: string }
          out.push({ chainId: cid, name: entry.name || String(cid), url, ok: false, error: e.message || String(err) })
        }
      }
    }
    setStats(out)
    setRunning(false)
  }, [running])

  useEffect(() => {
    if (open && stats.length === 0) {
      run()
    }
  }, [open, stats.length, run])

  if (!open) return null

  return (
    <div className="fixed bottom-4 right-4 w-[420px] max-h-[60vh] overflow-auto bg-background border border-border shadow-lg rounded-lg p-4 text-sm z-[200]">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">RPC Health <span className="text-xs text-muted-foreground">(Ctrl/⌘+H)</span></div>
        <div className="space-x-2">
          <button onClick={run} disabled={running} className="px-2 py-1 text-xs rounded bg-primary/10 hover:bg-primary/20 disabled:opacity-50">{running ? 'Running…' : 'Re-run'}</button>
          <button onClick={() => setOpen(false)} className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80">Close</button>
        </div>
      </div>
      {stats.length === 0 && <div className="text-muted-foreground">Collecting…</div>}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-left border-b border-border">
            <th className="py-1 pr-2">Chain</th>
            <th className="py-1 pr-2">Latency</th>
            <th className="py-1 pr-2">URL</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={i} className="border-b border-border/40 last:border-b-0 align-top">
              <td className="py-1 pr-2 font-medium whitespace-nowrap">{s.name}</td>
              <td className={`py-1 pr-2 whitespace-nowrap ${s.ok ? (s.latencyMs! < 800 ? 'text-green-600' : 'text-yellow-600') : 'text-red-600'}`}>{s.ok ? `${s.latencyMs} ms` : 'ERR'}</td>
              <td className="py-1 pr-2 break-all text-muted-foreground max-w-[240px]">{s.url}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-xs text-muted-foreground">Hold ⌘/Ctrl and press H to toggle. Uses getBlockNumber for latency sampling.</div>
    </div>
  )
}

export default RpcHealthPanel
