// HKA DEX Contract Addresses and Configuration
// Generated from deployment on 2025-08-21

export const NETWORKS = {
  ETHEREUM_SEPOLIA: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
  rpcUrl: import.meta.env?.VITE_RPC_ETHEREUM_SEPOLIA,
    blockExplorer: 'https://sepolia.etherscan.io',
    contracts: {
      testETH: '0xdc1DCA3041ec84d72cCDC3a761B080451AB350AD',
      testUSDC: '0x787a258717489a07a537d1377A0ee14767BB53c4',
      orderBookEngine: '0xBF7784eB164abc8162276D9a5E8FC6D4d81A7B5f',
      ammEngine: '0x963aED7a6A603edc51F2938af0bdFFadEf28e9bC'
    }
  },
  ARBITRUM_SEPOLIA: {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
  rpcUrl: import.meta.env?.VITE_RPC_ARBITRUM_SEPOLIA,
    blockExplorer: 'https://sepolia.arbiscan.io',
    contracts: {
      testETH: '0xcfa48E2daed3aC8177B752c6825aF47C8c555A79',
      testUSDC: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
      orderBookEngine: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
      ammEngine: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3'
    }
  },
  OPTIMISM_SEPOLIA: {
    chainId: 11155420,
    name: 'Optimism Sepolia',
  rpcUrl: import.meta.env?.VITE_RPC_OPTIMISM_SEPOLIA,
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
    contracts: {
      testETH: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
      testUSDC: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
      orderBookEngine: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
      ammEngine: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F'
    }
  },
  BASE_SEPOLIA: {
    chainId: 84532,
    name: 'Base Sepolia',
  rpcUrl: import.meta.env?.VITE_RPC_BASE_SEPOLIA,
    blockExplorer: 'https://sepolia.basescan.org',
    contracts: {
      testETH: '0xcfa48E2daed3aC8177B752c6825aF47C8c555A79',
      testUSDC: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
      orderBookEngine: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
      ammEngine: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3'
    }
  }
};

export const SUPPORTED_CHAINS = [
  NETWORKS.ETHEREUM_SEPOLIA.chainId,
  NETWORKS.ARBITRUM_SEPOLIA.chainId,
  NETWORKS.OPTIMISM_SEPOLIA.chainId,
  NETWORKS.BASE_SEPOLIA.chainId
];

export const getNetworkByChainId = (chainId: number) => {
  return Object.values(NETWORKS).find(network => network.chainId === chainId);
};

export const getContractAddress = (chainId: number, contractName: string) => {
  const network = getNetworkByChainId(chainId);
  return network?.contracts?.[contractName as keyof typeof network.contracts];
};

// AMM Configuration
export const AMM_CONFIG = {
  swapFee: 30, // 0.3% in basis points
  protocolFee: 5, // 0.05% in basis points
  minLiquidity: 1000 // Minimum liquidity for pool creation
};

// Token Configuration
export const TOKEN_CONFIG = {
  testETH: {
    symbol: 'TestETH',
    name: 'Test Ethereum',
    decimals: 18
  },
  testUSDC: {
    symbol: 'TestUSDC', 
    name: 'Test USD Coin',
    decimals: 18
  }
};

// Deployer address for test token requests
export const DEPLOYER_ADDRESS = '0x88Da07480b511AbdAF549BC18b206A1D5bB87bDB';
