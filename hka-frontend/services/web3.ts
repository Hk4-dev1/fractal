// Web3 Provider Management untuk Multi-Chain
// Support switching between different chains untuk cross-chain operations

import { ethers, JsonRpcProvider, BrowserProvider, Contract, Signer } from 'ethers';
import { SUPPORTED_CHAINS, CROSSCHAIN_RELAY_ABI } from './layerzero-config';
import type { Network } from '../types/crosschain';

class Web3Service {
  private providers: Map<string, JsonRpcProvider> = new Map();
  private signers: Map<string, Signer> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private currentChain: string = 'ethereum';

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize providers untuk semua supported chains
   */
  private initializeProviders() {
    Object.values(SUPPORTED_CHAINS).forEach(chain => {
      const provider = new JsonRpcProvider(chain.rpcUrl);
      this.providers.set(chain.id, provider);
    });
  }

  /**
   * Get provider untuk specific chain
   */
  getProvider(chainId: string): JsonRpcProvider | null {
    return this.providers.get(chainId) || null;
  }

  /**
   * Connect wallet untuk specific chain
   */
  async connectWallet(chainId: string): Promise<Signer | null> {
    try {
      // Check if MetaMask is available
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        
        // Request account access
        await provider.send("eth_requestAccounts", []);
        
        // Switch to correct network if needed
        const targetChain = Object.values(SUPPORTED_CHAINS).find(c => c.id === chainId);
        if (targetChain) {
          await this.switchNetwork(targetChain as unknown as Network & { rpcUrl?: string });
        }
        
        const signer = await provider.getSigner();
        this.signers.set(chainId, signer);
        
        return signer;
      }
      
      throw new Error('MetaMask not available');
    } catch (error) {
      console.error(`Failed to connect wallet for ${chainId}:`, error);
      return null;
    }
  }

  /**
   * Switch MetaMask to specific network
   */
  private async switchNetwork(network: Network & { rpcUrl?: string }): Promise<void> {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${network.chainId.toString(16)}` }],
      });
    } catch (switchError: unknown) {
      // Network belum ditambahkan ke MetaMask
      const code = (switchError as { code?: number }).code
      if (code === 4902) {
        await this.addNetwork(network);
      } else {
        throw switchError;
      }
    }
  }

  /**
   * Add network ke MetaMask
   */
  private async addNetwork(network: Network): Promise<void> {
    if (!window.ethereum) return;

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${network.chainId.toString(16)}`,
        chainName: network.name,
        nativeCurrency: {
          name: network.nativeToken,
          symbol: network.nativeToken,
          decimals: 18,
        },
        rpcUrls: [network.rpcUrl],
        blockExplorerUrls: [network.blockExplorer],
      }],
    });
  }

  /**
   * Get CrossChainRelay contract instance
   */
  getRelayContract(chainId: string, withSigner: boolean = false): Contract | null {
    const contractKey = `${chainId}_${withSigner ? 'signer' : 'provider'}`;
    
    if (this.contracts.has(contractKey)) {
      return this.contracts.get(contractKey)!;
    }

    const chain = Object.values(SUPPORTED_CHAINS).find(c => c.id === chainId);
    if (!chain) return null;

    let providerOrSigner: JsonRpcProvider | Signer;
    
    if (withSigner) {
      const signer = this.signers.get(chainId);
      if (!signer) return null;
      providerOrSigner = signer;
    } else {
      const provider = this.providers.get(chainId);
      if (!provider) return null;
      providerOrSigner = provider;
    }

    const contract = new Contract(
      chain.relayContract,
      CROSSCHAIN_RELAY_ABI,
      providerOrSigner
    );

    this.contracts.set(contractKey, contract);
    return contract;
  }

  /**
   * Get current wallet address
   */
  async getWalletAddress(chainId: string): Promise<string | null> {
    const signer = this.signers.get(chainId);
    if (!signer) return null;
    
    try {
      return await signer.getAddress();
    } catch (error) {
      console.error('Failed to get wallet address:', error);
      return null;
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(chainId: string): Promise<string> {
    try {
      const provider = this.providers.get(chainId);
      const signer = this.signers.get(chainId);
      if (!provider || !signer) return '0';
      
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      return '0';
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(
    chainId: string,
    contractMethod: string,
    params: unknown[],
    overrides?: Record<string, unknown>
  ): Promise<bigint | null> {
    try {
      const contract = this.getRelayContract(chainId, true);
      if (!contract) return null;

      // Use getFunction to get the specific method
      const method = contract.getFunction(contractMethod);
      return await method.estimateGas(...params, overrides || {});
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return null;
    }
  }

  /**
   * Check if wallet is connected untuk specific chain
   */
  isWalletConnected(chainId: string): boolean {
    return this.signers.has(chainId);
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet(chainId?: string) {
    if (chainId) {
      this.signers.delete(chainId);
      // Clear contracts for this chain
      this.contracts.forEach((_, key) => {
        if (key.startsWith(chainId)) {
          this.contracts.delete(key);
        }
      });
    } else {
      // Disconnect all
      this.signers.clear();
      this.contracts.clear();
    }
  }

  /**
   * Get current chain
   */
  getCurrentChain(): string {
    return this.currentChain;
  }

  /**
   * Set current chain
   */
  setCurrentChain(chainId: string) {
    this.currentChain = chainId;
  }
}

// Global web3 service instance
export const web3Service = new Web3Service();

// Helper function to get chain info
export function getChainInfo(chainId: string): (Network & { rpcUrl: string | undefined }) | null {
  return (Object.values(SUPPORTED_CHAINS).find(c => c.id === chainId) as (Network & { rpcUrl: string | undefined }) | undefined) || null;
}

// Helper function to format chain name
export function formatChainName(chainId: string): string {
  const chain = getChainInfo(chainId);
  return chain ? chain.name : chainId;
}

// window.ethereum typings are declared in global.d.ts
