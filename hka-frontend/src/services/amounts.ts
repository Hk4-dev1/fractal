import { ethers } from 'ethers'

export function parseAmount(amount: string, decimals: number): bigint {
  if (!amount || amount.trim() === '') return 0n
  return ethers.parseUnits(normalize(amount, decimals), decimals)
}

export function formatAmount(raw: bigint | string, decimals: number, maxDecimals: number = decimals): string {
  try {
    const v = typeof raw === 'string' ? BigInt(raw) : raw
    const out = ethers.formatUnits(v, decimals)
    if (maxDecimals < decimals) {
      const [w, d = ''] = out.split('.')
      if (!d) return w
      return d.length <= maxDecimals ? out : `${w}.${d.slice(0, maxDecimals)}`
    }
    return out
  } catch {
    return '0'
  }
}

function normalize(val: string, decimals: number): string {
  const trimmed = val.trim()
  if (!trimmed.includes('.')) return trimmed
  const [w, d] = trimmed.split('.')
  if (d.length <= decimals) return trimmed
  return `${w}.${d.slice(0, decimals)}`
}
