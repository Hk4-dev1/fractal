export type Address = `0x${string}`

export interface ContractsEntry {
  name: string
  rpc: string
  explorer: string
  testETH: Address
  testUSDC: Address
  orderBookEngine: Address
  ammEngine: Address
  weth: Address
  layerZeroRelay: Address
  crossChainEscrow: Address
  layerZeroEid?: number
}

export type ContractsMap = Record<number, ContractsEntry>
