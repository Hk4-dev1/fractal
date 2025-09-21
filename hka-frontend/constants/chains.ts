// Chain Logo Constants
export const CHAIN_LOGOS = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    logo: '/logos/ethereum.svg',
    iconUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#627EEA',
    gradient: 'from-[#627EEA] to-[#8A92B2]'
  },
  arbitrum: {
    name: 'Arbitrum One',
    symbol: 'ARB',
    logo: '/logos/arbitrum.svg', 
    iconUrl: 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg',
    color: '#2D374B',
    gradient: 'from-[#2D374B] to-[#96BEDC]'
  },
  bsc: {
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    logo: '/logos/bnb.svg',
    iconUrl: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg', 
    color: '#F3BA2F',
    gradient: 'from-[#F3BA2F] to-[#FDD835]'
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    logo: '/logos/polygon.svg',
    iconUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
    color: '#8247E5',
    gradient: 'from-[#8247E5] to-[#C084FC]'
  },
  avalanche: {
    name: 'Avalanche',
    symbol: 'AVAX', 
    logo: '/logos/avalanche.svg',
    iconUrl: 'https://cryptologos.cc/logos/avalanche-avax-logo.svg',
    color: '#E84142',
    gradient: 'from-[#E84142] to-[#FF6B6B]'
  },
  optimism: {
    name: 'Optimism',
    symbol: 'OP',
    logo: '/logos/optimism.svg',
    iconUrl: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg',
    color: '#FF0420',
    gradient: 'from-[#FF0420] to-[#FF4081]'
  },
  base: {
    name: 'Base',
    symbol: 'BASE',
    logo: '/logos/base.svg',
    iconUrl: 'https://cryptologos.cc/logos/base-base-logo.svg',
    color: '#0052FF',
    gradient: 'from-[#0052FF] to-[#5AA7FF]'
  }
};

// Logo component sizes
export const LOGO_SIZES = {
  xs: 'w-4 h-4',    // 16px
  sm: 'w-5 h-5',    // 20px  
  md: 'w-6 h-6',    // 24px
  lg: 'w-8 h-8',    // 32px
  xl: 'w-12 h-12',  // 48px
  '2xl': 'w-16 h-16' // 64px
};

// Chain status indicators
export const CHAIN_STATUS = {
  active: 'bg-green-500',
  inactive: 'bg-gray-400', 
  maintenance: 'bg-yellow-500',
  error: 'bg-red-500'
};
