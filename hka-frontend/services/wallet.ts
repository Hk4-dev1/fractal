// Enhanced Wallet Service with MetaMask SDK Best Practices
import { MetaMaskSDK } from '@metamask/sdk';
import { ethers, BrowserProvider, Signer } from 'ethers';
// Debug utilities
const DEBUG_DEX = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_DEX === 'true';
const dlog = (...args: unknown[]) => { if (DEBUG_DEX) console.log(...args); };
import { CONTRACTS } from './contracts';

// Define process for browser environment
declare const process: {
  env: {
    NODE_ENV: string;
  };
};

// Types
export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  isSwitchingNetwork: boolean;
  account: string | null;
  chainId: number | null;
  balance: string;
  provider: BrowserProvider | null;
  signer: Signer | null;
}

export interface NetworkInfo {
  chainId: number;
  name: string;
  rpc: string;
  explorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Supported networks for the DEX
export const SUPPORTED_NETWORKS: { [key: number]: NetworkInfo } = {
  11155111: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
  rpc: import.meta.env?.VITE_RPC_ETHEREUM_SEPOLIA!,
    explorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
  },
  421614: {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
  rpc: import.meta.env?.VITE_RPC_ARBITRUM_SEPOLIA!,
    explorer: 'https://sepolia.arbiscan.io',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
  },
  11155420: {
    chainId: 11155420,
    name: 'Optimism Sepolia',
  rpc: import.meta.env?.VITE_RPC_OPTIMISM_SEPOLIA!,
    explorer: 'https://sepolia-optimism.etherscan.io',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
  },
  84532: {
    chainId: 84532,
    name: 'Base Sepolia',
  rpc: import.meta.env?.VITE_RPC_BASE_SEPOLIA!,
    explorer: 'https://sepolia.basescan.org',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
  }
};

// Event types
export type WalletEventType = 'connect' | 'disconnect' | 'accountChanged' | 'chainChanged' | 'error' | 'status';
export type WalletEventCallback = (data?: unknown) => void;

class EnhancedWalletService {
  private sdk: MetaMaskSDK | null = null;
  private state: WalletState = {
    isConnected: false,
    isConnecting: false,
  isSwitchingNetwork: false,
    account: null,
    chainId: null,
    balance: '0',
    provider: null,
    signer: null
  };
  
  private eventListeners: Map<WalletEventType, Set<WalletEventCallback>> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeEventListeners();
  }

  // Initialize MetaMask SDK with proper configuration
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
  dlog('🔧 Initializing MetaMask SDK...');
      
      this.sdk = new MetaMaskSDK({
        dappMetadata: {
          name: 'HKA DEX',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://hka-dex.com',
          iconUrl: typeof window !== 'undefined' ? `${window.location.origin}/favicon.ico` : undefined,
        },
        logging: {
          developerMode: process.env.NODE_ENV === 'development',
        },
        storage: {
          enabled: true,
        },
        checkInstallationImmediately: false,
        extensionOnly: false, // Support both extension and mobile
      });

      // Setup event listeners
      this.setupSDKEventListeners();
      
      // Try to restore previous connection
      await this.restoreConnection();
      
      this.isInitialized = true;
  dlog('✅ MetaMask SDK initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize MetaMask SDK:', error);
      this.emit('error', { message: 'Failed to initialize wallet service', error });
    }
  }

  // Setup SDK event listeners
  private setupSDKEventListeners(): void {
    if (!this.sdk) return;

    const provider = this.sdk.getProvider();
    if (!provider) return;

    // Account changes
    provider.on('accountsChanged', (...args: unknown[]) => {
      const accounts = args[0] as string[];
  dlog('📱 Accounts changed:', accounts);
      if (accounts.length === 0) {
        this.handleDisconnect();
      } else {
        this.handleAccountChange(accounts[0]);
      }
    });

    // Chain changes
    provider.on('chainChanged', (...args: unknown[]) => {
      const chainId = args[0] as string;
  dlog('🔗 Chain changed:', chainId);
      this.handleChainChange(parseInt(chainId, 16));
    });

    // Connection
    provider.on('connect', (...args: unknown[]) => {
      const connectInfo = args[0] as { chainId: string };
  dlog('🔌 Connected:', connectInfo);
      this.handleConnect(parseInt(connectInfo.chainId, 16));
    });

    // Disconnection
    provider.on('disconnect', (error: unknown) => {
  dlog('🔌 Disconnected:', error);
      this.handleDisconnect();
    });
  }

  // Connect to MetaMask
  async connect(): Promise<WalletState> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.sdk) {
      throw new Error('MetaMask SDK not initialized');
    }

    try {
      this.setState({ isConnecting: true });
  dlog('🔄 Connecting to MetaMask...');

      const provider = this.sdk.getProvider();
      if (!provider) {
        throw new Error('MetaMask provider not available');
      }

      // Request account access
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

      // Create ethers provider
      const ethersProvider = new BrowserProvider(provider);
      const network = await ethersProvider.getNetwork();
      const signer = await ethersProvider.getSigner();
      const balance = await ethersProvider.getBalance(accounts[0]);

      // Update state
      this.setState({
        isConnected: true,
        isConnecting: false,
  isSwitchingNetwork: false,
        account: accounts[0],
        chainId: Number(network.chainId),
        balance: ethers.formatEther(balance),
        provider: ethersProvider,
        signer
      });

      // Store connection state
      localStorage.setItem('wallet_connected', 'true');
      localStorage.setItem('wallet_account', accounts[0]);

  dlog('✅ Connected to MetaMask:', {
        account: accounts[0],
        chainId: Number(network.chainId),
        balance: ethers.formatEther(balance)
      });

      this.emit('connect', this.state);
      return this.state;

    } catch (error: unknown) {
      console.error('❌ Connection failed:', error);
      this.setState({ 
        isConnecting: false,
        isConnected: false 
      });
      
      // Handle specific MetaMask errors
      const err = error as { code?: number; message?: string };
      if (err.code === 4001) {
        throw new Error('User rejected the connection request');
      } else if (err.code === -32002) {
        throw new Error('Connection request already pending');
      } else {
        const errorMessage = err.message || 'Unknown error';
        throw new Error(`Connection failed: ${errorMessage}`);
      }
    }
  }

  // Disconnect wallet
  async disconnect(): Promise<void> {
    try {
  dlog('🔌 Disconnecting wallet...');
      
      // Clear state
      this.setState({
        isConnected: false,
        isConnecting: false,
  isSwitchingNetwork: false,
        account: null,
        chainId: null,
        balance: '0',
        provider: null,
        signer: null
      });

      // Clear storage
      localStorage.removeItem('wallet_connected');
      localStorage.removeItem('wallet_account');

      this.emit('disconnect');
  dlog('✅ Wallet disconnected');

    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  }

  // Switch to specific network
  async switchNetwork(chainId: number): Promise<void> {
    if (!this.sdk) {
      throw new Error('MetaMask not connected');
    }

    const provider = this.sdk.getProvider();
    if (!provider) {
      throw new Error('MetaMask provider not available');
    }

    const network = SUPPORTED_NETWORKS[chainId];
    if (!network) {
      throw new Error(`Unsupported network: ${chainId}`);
    }

    try {
  dlog(`🔄 Switching to ${network.name}...`);
  this.setState({ isSwitchingNetwork: true });
  this.emit('status', this.state);

      // Try to switch to the network
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });

      // Wait for provider/network to be truly ready and refresh state
      await this.waitForChainReady(chainId);
  dlog(`✅ Switched and ready on ${network.name}`);

    } catch (error: unknown) {
      // Network not added to MetaMask yet
      const err = error as { code?: number; message?: string };
      if (err.code === 4902) {
        await this.addNetwork(network);
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
        await this.waitForChainReady(chainId);
      } else {
        console.error('❌ Network switch failed:', error);
        const errorMessage = err.message || 'Unknown error';
        throw new Error(`Failed to switch network: ${errorMessage}`);
      }
    } finally {
      this.setState({ isSwitchingNetwork: false });
      this.emit('status', this.state);
    }
  }

  // Add network to MetaMask
  private async addNetwork(network: NetworkInfo): Promise<void> {
    if (!this.sdk) return;

    const provider = this.sdk.getProvider();
    if (!provider) return;

    try {
  dlog(`🔄 Adding ${network.name} to MetaMask...`);

      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${network.chainId.toString(16)}`,
          chainName: network.name,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: [network.rpc],
          blockExplorerUrls: [network.explorer],
        }],
      });

  dlog(`✅ Added ${network.name} to MetaMask`);

    } catch (error) {
      console.error(`❌ Failed to add ${network.name}:`, error);
      throw error;
    }
  }

  // Restore connection from localStorage
  private async restoreConnection(): Promise<void> {
    const wasConnected = localStorage.getItem('wallet_connected') === 'true';
    const savedAccount = localStorage.getItem('wallet_account');

    if (wasConnected && savedAccount && this.sdk) {
      try {
  dlog('🔄 Restoring previous connection...');
        const provider = this.sdk.getProvider();
        
        if (provider) {
          const accounts = await provider.request({
            method: 'eth_accounts',
          }) as string[];

          if (accounts.includes(savedAccount)) {
            await this.connect();
          } else {
            // Clear invalid stored data
            localStorage.removeItem('wallet_connected');
            localStorage.removeItem('wallet_account');
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to restore connection:', error);
        localStorage.removeItem('wallet_connected');
        localStorage.removeItem('wallet_account');
      }
    }
  }

  // Event handlers
  private handleConnect(chainId: number): void {
    this.setState({ chainId });
    this.emit('connect', this.state);
  }

  private handleDisconnect(): void {
    this.setState({
      isConnected: false,
      account: null,
      chainId: null,
      balance: '0',
      provider: null,
      signer: null
    });
    localStorage.removeItem('wallet_connected');
    localStorage.removeItem('wallet_account');
    this.emit('disconnect');
  }

  private async handleAccountChange(account: string): Promise<void> {
    if (this.state.account !== account && this.state.provider) {
      const balance = await this.state.provider.getBalance(account);
      this.setState({
        account,
        balance: ethers.formatEther(balance)
      });
      localStorage.setItem('wallet_account', account);
      this.emit('accountChanged', { account, balance: ethers.formatEther(balance) });
    }
  }

  private async handleChainChange(chainId: number): Promise<void> {
    if (this.state.chainId !== chainId) {
  dlog(`🔗 Handling chain change from ${this.state.chainId} to ${chainId}`);
      
      this.setState({ chainId });
      
      // Force refresh provider and signer for new chain
      if (this.sdk && this.state.account) {
        try {
          dlog('🔄 Refreshing provider and signer for new chain...');
          const sdkProvider = this.sdk.getProvider();
          if (!sdkProvider) {
            throw new Error('SDK provider not available');
          }
          
          const provider = new ethers.BrowserProvider(sdkProvider);
          const signer = await provider.getSigner();
          
          this.setState({ 
            provider, 
            signer,
            chainId // Make sure chainId is set again
          });
          
          dlog('✅ Provider and signer refreshed for new chain');
          
          // Update balance for new chain
          const balance = await provider.getBalance(this.state.account);
          this.setState({ balance: ethers.formatEther(balance) });
          
        } catch (error) {
          console.error('❌ Error refreshing provider/signer:', error);
        }
      }
      
      this.emit('chainChanged', { chainId });
    }
  }

  // Wait until the provider actually reports the requested chain, then refresh signer/balance
  async waitForChainReady(targetChainId: number, timeoutMs: number = 15000): Promise<void> {
    if (!this.sdk) throw new Error('MetaMask not connected');
    const sdkProvider = this.sdk.getProvider();
    if (!sdkProvider) throw new Error('SDK provider not available');

    const start = Date.now();
    let lastError: unknown = null;
    while (Date.now() - start < timeoutMs) {
      try {
        const provider = new ethers.BrowserProvider(sdkProvider);
        const network = await provider.getNetwork();
        if (Number(network.chainId) === targetChainId) {
          // Refresh state provider/signer/balance
          const signer = await provider.getSigner();
          let balanceStr = this.state.balance;
          if (this.state.account) {
            const bal = await provider.getBalance(this.state.account);
            balanceStr = ethers.formatEther(bal);
          }
          this.setState({ provider, signer, chainId: targetChainId, balance: balanceStr });
          // Also emit chainChanged to notify listeners
          this.emit('chainChanged', { chainId: targetChainId });
          // Small settle delay
          await new Promise(r => setTimeout(r, 120));
          return;
        }
      } catch (e) {
        lastError = e;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    console.warn('⏳ waitForChainReady timed out');
    if (lastError) console.warn('Last error during waitForChainReady:', lastError);
  }

  // State management
  private setState(updates: Partial<WalletState>): void {
    this.state = { ...this.state, ...updates };
  }

  // Event system
  on(event: WalletEventType, callback: WalletEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: WalletEventType, callback: WalletEventCallback): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: WalletEventType, data?: unknown): void {
    this.eventListeners.get(event)?.forEach(callback => callback(data));
  }

  private initializeEventListeners(): void {
    // Initialize event listener maps
  (['connect', 'disconnect', 'accountChanged', 'chainChanged', 'error', 'status'] as WalletEventType[])
      .forEach(event => this.eventListeners.set(event, new Set()));
  }

  // Getters
  getState(): WalletState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.isConnected;
  }

  getAccount(): string | null {
    return this.state.account;
  }

  getChainId(): number | null {
    return this.state.chainId;
  }

  getProvider(): BrowserProvider | null {
    return this.state.provider;
  }

  getSigner(): Signer | null {
    return this.state.signer;
  }

  // Contract helpers
  getContractAddresses(chainId?: number): typeof CONTRACTS[keyof typeof CONTRACTS] | null {
    const targetChainId = chainId || this.state.chainId;
    if (!targetChainId) return null;
    return CONTRACTS[targetChainId as keyof typeof CONTRACTS] || null;
  }

  // Network helpers
  getSupportedNetworks(): NetworkInfo[] {
    return Object.values(SUPPORTED_NETWORKS);
  }

  isNetworkSupported(chainId: number): boolean {
    return chainId in SUPPORTED_NETWORKS;
  }

  getCurrentNetwork(): NetworkInfo | null {
    if (!this.state.chainId) return null;
    return SUPPORTED_NETWORKS[this.state.chainId] || null;
  }
}

// Export singleton instance
export const walletService = new EnhancedWalletService();
