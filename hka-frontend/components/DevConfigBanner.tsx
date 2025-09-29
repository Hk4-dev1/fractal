import { useEffect, useState } from 'react'
import { validateContracts } from '../services/contracts.validate'
import CONTRACTS from '../services/contracts'
import type { ContractsEntry } from '../types/contracts'

type Issue = { chainId: number; message: string }

export function DevConfigBanner() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [hidden, setHidden] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (import.meta.env?.MODE !== 'development') return
    try {
      const prev = sessionStorage.getItem('hka_hide_dev_config_banner') === '1'
      if (prev) { setHidden(true); return }
      const list = validateContracts()
      if (list.length) setIssues(list)
    } catch { /* ignore */ }
  }, [])

  if (import.meta.env?.MODE !== 'development') return null
  if (hidden || issues.length === 0) return null

  const byChain = issues.reduce<Record<number, string[]>>((acc, cur) => {
    acc[cur.chainId] = acc[cur.chainId] || []
    acc[cur.chainId].push(cur.message)
    return acc
  }, {})

  const envKeys = (cid: number): { main: string; fallbacks: string } | null => {
    switch (cid) {
      case 11155111: return { main: 'VITE_RPC_ETHEREUM_SEPOLIA', fallbacks: 'VITE_RPC_ETHEREUM_SEPOLIA_FALLBACKS' }
      case 421614: return { main: 'VITE_RPC_ARBITRUM_SEPOLIA', fallbacks: 'VITE_RPC_ARBITRUM_SEPOLIA_FALLBACKS' }
      case 11155420: return { main: 'VITE_RPC_OPTIMISM_SEPOLIA', fallbacks: 'VITE_RPC_OPTIMISM_SEPOLIA_FALLBACKS' }
      case 84532: return { main: 'VITE_RPC_BASE_SEPOLIA', fallbacks: 'VITE_RPC_BASE_SEPOLIA_FALLBACKS' }
      default: return null
    }
  }

  const toggle = (cid: number) => setExpanded(prev => ({ ...prev, [cid]: !prev[cid] }))

  const onClose = () => {
    setHidden(true)
    try { sessionStorage.setItem('hka_hide_dev_config_banner', '1') } catch { /* ignore */ }
  }

  return (
    <div className="mx-4 my-2 rounded-md border border-yellow-500/40 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">
      <div className="px-3 py-2 flex items-start gap-3">
        <div className="mt-0.5">⚠️</div>
        <div className="flex-1">
          <div className="font-medium">Config warnings (development only)</div>
          <div className="text-xs mt-1 space-y-2">
            {Object.keys(byChain).map((k) => {
              const cid = Number(k)
              const entry = (CONTRACTS as Record<number, Partial<ContractsEntry>>)[cid]
              const ek = envKeys(cid)
              const expl = entry?.explorer
              const name = entry?.name || String(cid)
              const isOpen = !!expanded[cid]
              return (
                <div key={cid} className="border border-yellow-500/30 rounded p-2 bg-white/60 dark:bg-black/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{name}</span>
                      <span className="opacity-70 ml-2">(chain {cid})</span>
                    </div>
                    <div className="space-x-2">
                      {expl && <a className="underline hover:opacity-80" href={expl} target="_blank" rel="noreferrer">Explorer</a>}
                      <button className="px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900 hover:bg-yellow-200 dark:hover:bg-yellow-800" onClick={() => toggle(cid)}>{isOpen ? 'Hide details' : 'Details'}</button>
                    </div>
                  </div>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {byChain[cid].map((msg, i) => (<li key={i}>{msg}</li>))}
                  </ul>
                  {isOpen && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <div className="font-medium mb-1">Addresses</div>
                        <ul className="space-y-1">
                          {entry?.orderBookEngine && (
                            <li>OrderBook: {expl ? (<a className="underline" target="_blank" rel="noreferrer" href={`${expl}/address/${entry.orderBookEngine}`}>{entry.orderBookEngine}</a>) : entry.orderBookEngine}</li>
                          )}
                          {entry?.ammEngine && (
                            <li>AMM: {expl ? (<a className="underline" target="_blank" rel="noreferrer" href={`${expl}/address/${entry.ammEngine}`}>{entry.ammEngine}</a>) : entry.ammEngine}</li>
                          )}
                          {entry?.crossChainEscrow && (
                            <li>Escrow: {expl ? (<a className="underline" target="_blank" rel="noreferrer" href={`${expl}/address/${entry.crossChainEscrow}`}>{entry.crossChainEscrow}</a>) : entry.crossChainEscrow}</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium mb-1">RPC & env</div>
                        <ul className="space-y-1">
                          {entry?.rpc && (<li>RPC: <span className="break-all text-muted-foreground">{entry.rpc}</span></li>)}
                          {ek && (<li>Env: <code>{ek.main}</code>{' '}<span className="opacity-70">(+ <code>{ek.fallbacks}</code> comma-separated)</span></li>)}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <button onClick={onClose} className="text-xs px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900 hover:bg-yellow-200 dark:hover:bg-yellow-800">Hide</button>
      </div>
    </div>
  )
}

export default DevConfigBanner
