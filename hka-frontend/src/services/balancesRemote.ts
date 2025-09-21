import { Contract, ethers } from 'ethers'
import CONTRACTS from '../../services/contracts'
import { getCachedProvider, withRetries } from './providerCache'

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
  const provider = getCachedProvider(chainId)

  const addr = getTokenAddressForSymbol(chainId, symbol)
  if (addr === '0x0000000000000000000000000000000000000000') {
    const bal = await withRetries(() => provider.getBalance(account))
    return ethers.formatEther(bal)
  }

  const token = new Contract(addr, ERC20_ABI, provider)
  const [bal, dec] = await withRetries(() => Promise.all([token.balanceOf(account), token.decimals()]))
  return ethers.formatUnits(bal, dec)
}
