// Contract addresses from successful deployments
export const CONTRACTS = {
  11155111: { // Ethereum Sepolia
    name: 'Ethereum Sepolia',
  rpc: 'https://eth-sepolia.public.blastapi.io',
    explorer: 'https://sepolia.etherscan.io',
    testETH: '0xdc1DCA3041ec84d72cCDC3a761B080451AB350AD',
    testUSDC: '0x787a258717489a07a537d1377A0ee14767BB53c4',
    orderBookEngine: '0xBF7784eB164abc8162276D9a5E8FC6D4d81A7B5f',
    ammEngine: '0x963aED7a6A603edc51F2938af0bdFFadEf28e9bC',
    weth: '0x0eA0d0923BC5ac5d17DdEc73Af06FaC1a7816927', // ✨ Added WETH
    layerZeroRelay: '0x3307a91941023Cd8eb60fB6C3eBd02E041dd6CB6',
    crossChainEscrow: '0xe09570Ba8fA370467C4bae17bd57D2C8556ddB1a', // ✨ Added CrossChainEscrow
    layerZeroEid: 40161
  },
  421614: { // Arbitrum Sepolia  
    name: 'Arbitrum Sepolia',
  rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    testETH: '0xcfa48E2daed3aC8177B752c6825aF47C8c555A79',
    testUSDC: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
    orderBookEngine: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
    ammEngine: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
    weth: '0x8422972b99AD56341C36480CCCA687E11A55662F', // ✨ Added WETH
    layerZeroRelay: '0x92cc9842c958D5c1d6c62C4C99DfFC2b7C3f2bcC',
    crossChainEscrow: '0x0b14bEd09a7B9EABe616Ac0dC566F62590c87268', // ✨ Added CrossChainEscrow
  layerZeroEid: 40243
  },
  11155420: { // Optimism Sepolia
    name: 'Optimism Sepolia', 
  rpc: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io',
    testETH: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
    testUSDC: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
    orderBookEngine: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
    ammEngine: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F',
    weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa', // ✨ Added WETH
    layerZeroRelay: '0xEf36682745DE4273D28B17eD2b55F638e0095945',
    crossChainEscrow: '0x0044650c75DC3fF50bB62cA7CBdbd59Cc9CAe91F', // ✨ Added CrossChainEscrow
    layerZeroEid: 40232
  },
  84532: { // Base Sepolia
    name: 'Base Sepolia',
  rpc: 'https://sepolia.base.org', 
    explorer: 'https://sepolia.basescan.org',
    testETH: '0xcfa48E2daed3aC8177B752c6825aF47C8c555A79',
    testUSDC: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
    orderBookEngine: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
    ammEngine: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
    weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8', // ✅ Fixed checksum
    layerZeroRelay: '0xEf36682745DE4273D28B17eD2b55F638e0095945',
    crossChainEscrow: '0xaba4c0b9335572efF9bb1DB53Eaa556e51ab8A8d', // ✨ Added CrossChainEscrow
    layerZeroEid: 40245
  }
};

// Helper functions
export const getSupportedChains = () => Object.keys(CONTRACTS).map(Number);

export const getContractAddress = (chainId: number, contractType: keyof typeof CONTRACTS[11155111]) => {
  return CONTRACTS[chainId as keyof typeof CONTRACTS]?.[contractType];
};

export const getChainName = (chainId: number) => {
  return CONTRACTS[chainId as keyof typeof CONTRACTS]?.name;
};

export const getExplorerUrl = (chainId: number, txHash?: string) => {
  const explorer = CONTRACTS[chainId as keyof typeof CONTRACTS]?.explorer;
  return txHash ? `${explorer}/tx/${txHash}` : explorer;
};

// Cross-chain pairs for LayerZero messaging
export const CROSS_CHAIN_PAIRS = [
  { from: 11155111, to: 421614, name: 'Ethereum → Arbitrum' }, // ✅ Confirmed working
  { from: 421614, to: 11155111, name: 'Arbitrum → Ethereum' }, // ✅ Confirmed working  
  { from: 11155111, to: 11155420, name: 'Ethereum → Optimism' },
  { from: 11155111, to: 84532, name: 'Ethereum → Base' },
  { from: 421614, to: 11155420, name: 'Arbitrum → Optimism' },
  { from: 421614, to: 84532, name: 'Arbitrum → Base' },
  { from: 11155420, to: 84532, name: 'Optimism → Base' },
  { from: 84532, to: 11155420, name: 'Base → Optimism' },
  { from: 11155420, to: 11155111, name: 'Optimism → Ethereum' },
  { from: 84532, to: 11155111, name: 'Base → Ethereum' },
  { from: 11155420, to: 421614, name: 'Optimism → Arbitrum' },
  { from: 84532, to: 421614, name: 'Base → Arbitrum' }
];

// Deployer address (for test token requests)
export const DEPLOYER_ADDRESS = '0x88Da07480b511AbdAF549BC18b206A1D5bB87bDB';

export default CONTRACTS;
