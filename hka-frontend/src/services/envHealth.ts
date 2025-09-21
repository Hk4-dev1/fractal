import CONTRACTS from '../../services/contracts'

export function requireRpcs(): { ok: boolean; missing: Array<{ chainId: number; name: string; var: string }>; hints: string[] } {
  const rows: Array<{ chainId: number; name: string; var: string; present: boolean }> = [
    { chainId: 11155111, name: 'Ethereum Sepolia', var: 'VITE_RPC_ETHEREUM_SEPOLIA', present: !!import.meta.env?.VITE_RPC_ETHEREUM_SEPOLIA },
    { chainId: 421614, name: 'Arbitrum Sepolia', var: 'VITE_RPC_ARBITRUM_SEPOLIA', present: !!import.meta.env?.VITE_RPC_ARBITRUM_SEPOLIA },
    { chainId: 11155420, name: 'Optimism Sepolia', var: 'VITE_RPC_OPTIMISM_SEPOLIA', present: !!import.meta.env?.VITE_RPC_OPTIMISM_SEPOLIA },
    { chainId: 84532, name: 'Base Sepolia', var: 'VITE_RPC_BASE_SEPOLIA', present: !!import.meta.env?.VITE_RPC_BASE_SEPOLIA },
  ]
  const missing = rows.filter(r => !r.present).map(r => ({ chainId: r.chainId, name: r.name, var: r.var }))
  const ok = missing.length === 0
  const hints: string[] = ok ? [] : [
    'Add private RPCs to .env, e.g. VITE_RPC_ETHEREUM_SEPOLIA=https://sepolia.infura.io/v3/<key>',
    'Optionally set VITE_RPC_*_FALLBACKS with comma-separated backup URLs',
  ]
  // Touch CONTRACTS just to ensure env mapping is loaded in dev
  void CONTRACTS
  return { ok, missing, hints }
}

export function envHealthSummary(): string | null {
  const res = requireRpcs()
  if (res.ok) return null
  const lines = res.missing.map(m => `- ${m.name}: set ${m.var}`).join('\n')
  return `Missing RPC envs:\n${lines}`
}
