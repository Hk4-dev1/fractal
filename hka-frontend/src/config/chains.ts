export type ChainKey = 'ethereum-sepolia' | 'arbitrum-sepolia' | 'optimism-sepolia' | 'base-sepolia'

export const LZ_EIDS: Record<ChainKey, number> = {
  'ethereum-sepolia': 40161,
  'arbitrum-sepolia': 40243,
  'optimism-sepolia': 40232,
  'base-sepolia': 40245,
}

export const ESCROWS: Record<ChainKey, `0x${string}`> = {
  'ethereum-sepolia': '0xb04057fD0dAF231A16BE26a566F762b24D602816',
  'arbitrum-sepolia': '0x02f93dcCF6F93D170c622AE391315c2e90a1e628',
  'optimism-sepolia': '0x238a9a6A716B393C5B93EA52B1D99d0283212157',
  'base-sepolia': '0x83d705e272dDc2811CE87CD35b0Ec4bA52cF3D23',
}

export const ROUTERS: Record<ChainKey, `0x${string}`> = {
  // Point to deployed OAppRouterV2 addresses (must match backend wiring and peers)
  'ethereum-sepolia': '0xb77078E1d22F9390441C84ab0C00f656311b224e',
  'arbitrum-sepolia': '0x3D1D6bc8D8Af01Bff8751b03636c317e3B464b0D',
  'optimism-sepolia': '0x005D2E2fcDbA0740725E848cc1bCc019823f118C',
  'base-sepolia': '0x68bAB827101cD4C55d9994bc738f2ED8FfAB974F',
}

export const UI_TO_CHAINKEY: Record<string, ChainKey> = {
  ethereum: 'ethereum-sepolia',
  arbitrum: 'arbitrum-sepolia',
  optimism: 'optimism-sepolia',
  base: 'base-sepolia',
}
