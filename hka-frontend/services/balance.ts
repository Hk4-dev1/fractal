// Balance Service for fetching real wallet and token balances
import { ethers, Contract, Signer } from 'ethers';
import { web3Service } from './web3';
import { getNetworkByChainId, TOKEN_CONFIG } from './contract-config';
import type { UserBalance } from './api';

// ERC20 standard ABI for balance checking
const ERC20_MINIMAL_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export class BalanceService {
  /**
   * Get native token balance (ETH) for a wallet address
   */
  async getNativeBalance(chainId: string, address: string): Promise<string> {
    try {
      const provider = web3Service.getProvider(chainId);
      if (!provider) {
        throw new Error(`No provider for chain ${chainId}`);
      }

      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error(`Failed to get native balance for ${chainId}:`, error);
      return '0';
    }
  }

  /**
   * Get ERC20 token balance for a specific token contract
   */
  async getTokenBalance(
    chainId: string, 
    tokenAddress: string, 
    walletAddress: string,
    signer?: Signer
  ): Promise<{ balance: string; decimals: number; symbol: string }> {
    try {
      const provider = signer || web3Service.getProvider(chainId);
      if (!provider) {
        throw new Error(`No provider for chain ${chainId}`);
      }

      const tokenContract = new Contract(tokenAddress, ERC20_MINIMAL_ABI, provider);
      
      // Get balance, decimals, and symbol in parallel
      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals(),
        tokenContract.symbol()
      ]);

      const formattedBalance = ethers.formatUnits(balance, decimals);
      
      return {
        balance: formattedBalance,
        decimals: Number(decimals),
        symbol: symbol
      };
    } catch (error) {
      console.error(`Failed to get token balance for ${tokenAddress} on ${chainId}:`, error);
      return {
        balance: '0',
        decimals: 18,
        symbol: 'UNKNOWN'
      };
    }
  }

  /**
   * Get all balances for a wallet on a specific chain (native + tokens)
   */
  async getAllBalances(chainId: string, walletAddress: string, signer?: Signer): Promise<UserBalance[]> {
    try {
      // Map string chain IDs to numeric chain IDs for contract-config lookup
      const chainIdMap: Record<string, number> = {
        'ethereum': 11155111,
        'arbitrum': 421614,
        'optimism': 11155420,
        'base': 84532
      };

      const numericChainId = chainIdMap[chainId] || parseInt(chainId);
      const network = getNetworkByChainId(numericChainId);
      
      if (!network) {
        console.warn(`Network not found for chain ${chainId} (${numericChainId})`);
        return [];
      }

      const balances: UserBalance[] = [];

      // Get native token balance (ETH)
      const nativeBalance = await this.getNativeBalance(chainId, walletAddress);
      balances.push({
        asset: 'ETH', // All testnets use ETH as native token
        total: nativeBalance,
        available: nativeBalance,
        locked: '0'
      });

      // Get token balances (limit to USDC; no TestETH exposure)
      if (network.contracts) {
        // Only include USDC balance (labelled as USDC)
        if (network.contracts.testUSDC) {
          const usdcInfo = await this.getTokenBalance(chainId, network.contracts.testUSDC, walletAddress, signer);
          balances.push({
            asset: 'USDC',
            total: usdcInfo.balance,
            available: usdcInfo.balance,
            locked: '0'
          });
        }
      }

      return balances;
    } catch (error) {
      console.error(`Failed to get all balances for ${chainId}:`, error);
      return [];
    }
  }

  /**
   * Get balances across all supported chains for a connected wallet
   */
  async getAllChainsBalances(): Promise<UserBalance[]> {
    try {
      const allBalances: UserBalance[] = [];
      
      // Get balances from all supported networks
      const supportedChains = ['ethereum', 'arbitrum', 'optimism', 'base'];
      
      const balancePromises = supportedChains.map(async (chainId) => {
        try {
          // Check if wallet is connected for this chain
          const signer = web3Service.isWalletConnected(chainId) 
            ? await web3Service.connectWallet(chainId) 
            : null;
          
          if (!signer) {
            console.log(`No wallet connected for ${chainId}, skipping balance fetch`);
            return [];
          }

          const walletAddress = await signer.getAddress();
          return await this.getAllBalances(chainId, walletAddress, signer);
        } catch (error) {
          console.error(`Failed to get balances for network ${chainId}:`, error);
          return [];
        }
      });

      const networkBalances = await Promise.all(balancePromises);
      networkBalances.forEach(balances => {
        allBalances.push(...balances);
      });

      return allBalances;
    } catch (error) {
      console.error('Failed to get balances across all chains:', error);
      return [];
    }
  }

  /**
   * Get balance for specific token on specific chain
   */
  async getSpecificTokenBalance(
    chainId: string, 
    tokenSymbol: string, 
    walletAddress: string
  ): Promise<UserBalance | null> {
    try {
      // Map string chain IDs to numeric chain IDs
      const chainIdMap: Record<string, number> = {
        'ethereum': 11155111,
        'arbitrum': 421614,
        'optimism': 11155420,
        'base': 84532
      };

      const numericChainId = chainIdMap[chainId] || parseInt(chainId);
      const network = getNetworkByChainId(numericChainId);
      
      if (!network || !network.contracts) {
        return null;
      }

      // Handle native token
      if (tokenSymbol === 'ETH' || tokenSymbol === 'NATIVE') {
        const balance = await this.getNativeBalance(chainId, walletAddress);
        return {
          asset: 'ETH',
          total: balance,
          available: balance,
          locked: '0'
        };
      }

      // Handle test tokens
      const tokenKey = Object.keys(network.contracts).find(key => 
        key.toLowerCase().includes(tokenSymbol.toLowerCase()) ||
        TOKEN_CONFIG[key as keyof typeof TOKEN_CONFIG]?.symbol === tokenSymbol
      );

      if (!tokenKey) {
        console.warn(`Token ${tokenSymbol} not found on ${network.name}`);
        return null;
      }

      const tokenAddress = network.contracts[tokenKey as keyof typeof network.contracts];
      const tokenInfo = await this.getTokenBalance(chainId, tokenAddress, walletAddress);
      
      return {
        asset: tokenSymbol,
        total: tokenInfo.balance,
        available: tokenInfo.balance,
        locked: '0'
      };
    } catch (error) {
      console.error(`Failed to get specific token balance for ${tokenSymbol} on ${chainId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const balanceService = new BalanceService();
