import { CONTRACTS } from './contracts'
import type { ContractsEntry } from '../types/contracts'

export type ContractsValidationIssue = { chainId: number; message: string }

export function validateContracts(): ContractsValidationIssue[] {
  const issues: ContractsValidationIssue[] = []
  for (const key of Object.keys(CONTRACTS)) {
    const chainId = Number(key)
  const c = (CONTRACTS as Record<number, Partial<ContractsEntry>>)[chainId]
    if (!c) { issues.push({ chainId, message: 'missing entry' }); continue }
  const required = ['name','rpc','explorer','orderBookEngine','ammEngine','layerZeroRelay','crossChainEscrow'] as const
    for (const field of required) {
      const val = c[field]
      if (!val || typeof val !== 'string' || (!val.startsWith('http') && val.length < 42)) {
        issues.push({ chainId, message: `field ${field} seems invalid: ${String(val)}` })
      }
    }
  }
  return issues
}
