import { getViemClient } from './providerCache'
import { parseAbi } from 'viem'
import { formatUnits } from '../../services/viemAdapter'
import CONTRACTS from '../../services/contracts'
import { withRetries } from './providerCache'

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

type ContractsEntry = { weth: string; testUSDC: string }
export function getTokenAddressForSymbol(chainId: number, symbol: string): string {
  const c = (CONTRACTS as Record<number, ContractsEntry>)[chainId]
  if (!c) throw new Error(`Unsupported chain: ${chainId}`)
  switch ((symbol || '').toUpperCase()) {
    case 'ETH':
      return '0x0000000000000000000000000000000000000000'
    case 'WETH':
      return c.weth
    case 'USDC':
      return c.testUSDC
    default:
      throw new Error(`Unknown token symbol ${symbol} on chain ${chainId}`)
  }
}

export async function getTokenFormattedBalance(params: {
  chainId: number
  account: string
  symbol: string
}): Promise<string> {
  const { chainId, account, symbol } = params
  // provider cache touched implicitly by getViemClient; no ethers provider
  const addr = getTokenAddressForSymbol(chainId, symbol)
  if (addr === '0x0000000000000000000000000000000000000000') {
    const client = getViemClient(chainId)
    const bal = await withRetries(() => client.getBalance({ address: account as `0x${string}` }))
    return formatUnits(bal, 18)
  }

  // viem path first (tree-shakable)
  try {
    const client = getViemClient(chainId)
    const abi = parseAbi(ERC20_ABI)
    const [bal, dec] = await withRetries(() => Promise.all([
      client.readContract({ address: addr as `0x${string}`, abi, functionName: 'balanceOf', args: [account as `0x${string}`] }) as Promise<bigint>,
      client.readContract({ address: addr as `0x${string}`, abi, functionName: 'decimals' }) as Promise<number | bigint>,
    ]))
    const decimals = typeof dec === 'bigint' ? Number(dec) : dec
    return formatUnits(bal, decimals)
  } catch {
    throw new Error('balance read failed (viem)')
  }
}
