// LayerZero V2 Configuration for Cross-Chain Futures
// Configuration yang sama dengan backend deployment

export const LAYERZERO_V2_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";

// LayerZero V2 EIDs (40xxx format untuk testnet)
export const LAYERZERO_V2_EIDS = {
  'Ethereum Sepolia': 40161,
  'Arbitrum Sepolia': 40243,
  'Optimism Sepolia': 40232,
  'Base Sepolia': 40245,
  'Polygon Amoy': 40267
} as const;

// Chain configurations
export const SUPPORTED_CHAINS = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    eid: LAYERZERO_V2_EIDS['Ethereum Sepolia'],
  rpcUrl: import.meta.env?.VITE_RPC_ETHEREUM_SEPOLIA,
    relayContract: '0x4C4F200944F9A5cB5e16966C663982A7ec33C3e0', // Update with actual deployed address
    nativeToken: 'ETH',
    logo: '⟠',
    color: 'text-blue-600',
    isActive: true,
    blockExplorer: 'https://sepolia.etherscan.io'
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    eid: LAYERZERO_V2_EIDS['Arbitrum Sepolia'],
  rpcUrl: import.meta.env?.VITE_RPC_ARBITRUM_SEPOLIA,
    relayContract: '0xf7f1616C41316D37AD35eed67f5853636CFb944b',
    nativeToken: 'ETH',
    logo: '🔵',
    color: 'text-blue-700',
    isActive: true,
    blockExplorer: 'https://sepolia.arbiscan.io'
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism Sepolia',
    chainId: 11155420,
    eid: LAYERZERO_V2_EIDS['Optimism Sepolia'],
  rpcUrl: import.meta.env?.VITE_RPC_OPTIMISM_SEPOLIA,
    relayContract: '0x9975502692F2Aa0Eef7F6969f0469fEced8865AE', // Update setelah deploy
    nativeToken: 'ETH',
    logo: '🔴',
    color: 'text-red-600',
    isActive: true,
    blockExplorer: 'https://sepolia-optimism.etherscan.io'
  },
  base: {
    id: 'base',
    name: 'Base Sepolia',
    chainId: 84532,
    eid: LAYERZERO_V2_EIDS['Base Sepolia'],
  rpcUrl: import.meta.env?.VITE_RPC_BASE_SEPOLIA,
    relayContract: '0x24Cb1030Bb8C451Ea2765C16Ea1A9b0b2Cd3Ee03', // Update setelah deploy
    nativeToken: 'ETH',
    logo: '🔵',
    color: 'text-blue-600',
    isActive: true,
    blockExplorer: 'https://sepolia.basescan.org'
  }
} as const;

// CrossChainRelayV2 ABI - functions yang kita butuhkan
export const CROSSCHAIN_RELAY_ABI = [
  "function quoteOrder(uint32 _dstEid, bytes _order, bytes _options, bool _payInLzToken) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee) fee)",
  "function sendOrder(uint32 _dstEid, bytes _order, bytes _options) payable",
  "function sendOrderSimple(uint32 _dstEid, bytes _order) payable",
  "function owner() view returns (address)",
  "function peers(uint32) view returns (bytes32)",
  "function endpoint() view returns (address)"
] as const;

// Gas limits untuk different operations
export const GAS_LIMITS = {
  CROSS_CHAIN_ORDER: 200000,
  SIMPLE_MESSAGE: 100000,
  COMPLEX_ORDER: 300000
} as const;

// Fee estimation multipliers
export const FEE_MULTIPLIERS = {
  SAFETY_MARGIN: 1.2, // 20% safety margin
  PRIORITY_FEE: 1.1    // 10% priority fee
} as const;

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;
export type LayerZeroEid = typeof LAYERZERO_V2_EIDS[keyof typeof LAYERZERO_V2_EIDS];
