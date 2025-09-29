// Enhanced Wallet Service (migrated off ethers -> minimal EIP-1193 + viem helpers)
import { MetaMaskSDK } from '@metamask/sdk';
import { formatUnits } from './viemAdapter'
// Debug utilities
const DEBUG_DEX = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_DEX === 'true';
const dlog = (...args: unknown[]) => { if (DEBUG_DEX) console.log(...args); };
import { CONTRACTS } from './contracts';
import type { Eip1193Provider } from '../types/eip1193'

// Types
export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  isSwitchingNetwork: boolean;
  account: string | null;
  chainId: number | null;
  balance: string; // ETH balance (formatted)
  provider: ProviderShim | null; // minimal shim (was BrowserProvider)
  signer: SignerShim | null;     // minimal shim (was Signer)
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

// Minimal EIP-1193 typings (augmented with MetaMask hints)
// using shared EIP-1193 type

class ProviderShim {
  constructor(public ethereum: Eip1193Provider) {}
  async getBalance(address: string): Promise<bigint> {
    const hex = await this.ethereum.request({ method: 'eth_getBalance', params: [address, 'latest'] }) as string
    return BigInt(hex)
  }
  async getNetwork(): Promise<{ chainId: bigint }> {
    const hex = await this.ethereum.request({ method: 'eth_chainId' }) as string
    return { chainId: BigInt(hex) }
  }
}

class SignerShim {
  constructor(private account: string, private provider: ProviderShim) {}
  async getAddress(): Promise<string> { return this.account }
  // For parity with legacy code expecting provider.getSigner().getAddress()
  getProvider(): ProviderShim { return this.provider }
}

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
  private isInitializing = false;
  private listenerBoundProviders: WeakSet<Eip1193Provider> = new WeakSet();

  constructor() {
    this.initializeEventListeners();
  }

  // Initialize MetaMask (prefer injected provider; only create SDK if needed)
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) return;

    this.isInitializing = true;

    try {
      dlog('🔧 Initializing MetaMask SDK...');
  const hasInjected = typeof window !== 'undefined' && !!(window as unknown as { ethereum?: unknown }).ethereum;
      if (!hasInjected) {
        this.sdk = this.buildSdk(false);
      }

      // Setup event listeners on whichever provider is available
      const injectedSoon = await this.waitForInjectedEthereum(2000);
      const winEth: Eip1193Provider | undefined = injectedSoon;
      const sdkProvider = this.sdk?.getProvider() as unknown as Eip1193Provider | undefined;
      const active = this.chooseInjectedProvider(winEth) || sdkProvider;
      if (active) {
        this.setupProviderEventListeners(active);
      }

      // Mark initialized BEFORE attempting restore to avoid re-entrant initialize() via connect()
      this.isInitialized = true;

      // Try to restore previous connection
      await this.restoreConnection();

      dlog('✅ MetaMask SDK initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize wallet service:', error);
      this.emit('error', { message: 'Failed to initialize wallet service', error });
      this.isInitialized = false;
    } finally {
      this.isInitializing = false;
    }
  }

  private buildSdk(extensionOnly: boolean): MetaMaskSDK {
    return new MetaMaskSDK({
      dappMetadata: {
        name: 'HKA DEX',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://hka-dex.com',
        iconUrl: typeof window !== 'undefined' ? `${window.location.origin}/favicon.ico` : undefined,
      },
      logging: {
        developerMode: (typeof import.meta !== 'undefined' && import.meta.env?.MODE) === 'development',
      },
      storage: { enabled: true },
      checkInstallationImmediately: false,
      extensionOnly,
    });
  }

  private getActiveProvider(): Eip1193Provider | undefined {
  const winEth = typeof window !== 'undefined' ? (window as unknown as { ethereum?: Eip1193Provider }).ethereum : undefined;
    const injected = this.chooseInjectedProvider(winEth);
    return injected || (this.sdk?.getProvider() as unknown as Eip1193Provider | undefined);
  }

  // Prefer MetaMask if multiple providers are injected
  private chooseInjectedProvider(injected?: Eip1193Provider): Eip1193Provider | undefined {
    if (!injected) return undefined;
    if (Array.isArray(injected.providers) && injected.providers.length) {
  const mm = injected.providers.find((p) => p.isMetaMask === true);
      return (mm as Eip1193Provider | undefined) || injected.providers[0];
    }
    return injected;
  }

  // Wait for MetaMask to inject window.ethereum (per MetaMask docs)
  private waitForInjectedEthereum(timeoutMs = 3000): Promise<Eip1193Provider | undefined> {
    return new Promise((resolve) => {
  const existing = typeof window !== 'undefined' ? (window as unknown as { ethereum?: Eip1193Provider }).ethereum : undefined;
      if (existing) return resolve(existing);
      let done = false;
      const onReady = () => {
        if (done) return;
        done = true;
        resolve((window as unknown as { ethereum?: Eip1193Provider }).ethereum);
      };
      window.addEventListener('ethereum#initialized' as unknown as string, onReady as EventListener, { once: true } as AddEventListenerOptions);
      setTimeout(() => {
        if (done) return;
        done = true;
        resolve((window as unknown as { ethereum?: Eip1193Provider }).ethereum);
      }, timeoutMs);
    });
  }

  // Setup provider event listeners (works for window.ethereum or SDK provider)
  private setupProviderEventListeners(provider: Eip1193Provider): void {
    // Avoid duplicate bindings on the same provider instance
    if (this.listenerBoundProviders.has(provider)) {
      dlog('ℹ️ Provider listeners already bound, skipping');
      return;
    }
    // Account changes
  provider.on?.('accountsChanged', (accounts: string[]) => {
  dlog('📱 Accounts changed:', accounts);
      if (accounts.length === 0) {
        this.handleDisconnect();
      } else {
        this.handleAccountChange(accounts[0]);
      }
    });

    // Chain changes
  provider.on?.('chainChanged', (chainId: string) => {
  dlog('🔗 Chain changed:', chainId);
      this.handleChainChange(parseInt(chainId, 16));
    });

    // Connection
  provider.on?.('connect', (connectInfo: { chainId: string }) => {
  dlog('🔌 Connected:', connectInfo);
      this.handleConnect(parseInt(connectInfo.chainId, 16));
    });

    // Disconnection
  provider.on?.('disconnect', (error: unknown) => {
  dlog('🔌 Disconnected:', error);
      this.handleDisconnect();
    });
  // Mark provider as bound to prevent duplicate listeners
  this.listenerBoundProviders.add(provider);
  }

  // Connect to MetaMask
  async connect(): Promise<WalletState> {
    if (!this.isInitialized) {
      await this.initialize();
    }

  // Prefer the injected extension provider when available (desktop)
  // Give the injector a brief chance if it was late
  let provider = this.getActiveProvider() || await this.waitForInjectedEthereum(1200) || this.getActiveProvider();

    try {
      this.setState({ isConnecting: true });
      this.emit('status', this.state);
  dlog('🔄 Connecting to MetaMask...');

      // If no active provider, try SDK connect (mobile deep-link / QR)
      if (!provider) {
        if (!this.sdk) throw new Error('MetaMask SDK not initialized');
        dlog('🪪 No injected provider. Attempting SDK connect…');
        try {
          // This triggers MetaMask Mobile/Deeplink flow where supported
          await this.sdk.connect();
          provider = this.getActiveProvider();
  } catch {
          throw new Error('MetaMask not available. Install the extension or open in MetaMask Mobile.');
        }
      }

      if (!provider) throw new Error('MetaMask provider not available');

      // Debug provider shape
      dlog('🔍 Provider details:', {
        hasRequest: typeof provider.request === 'function',
        isMetaMask: (provider as Eip1193Provider).isMetaMask === true,
        hasProvidersArray: Array.isArray((provider as Eip1193Provider).providers),
      });

      // Preflight check: see if already authorized
      let accounts = await provider.request({ method: 'eth_accounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        // Request account access with a timeout to surface UX hints
        const req = provider.request({ method: 'eth_requestAccounts' }) as Promise<unknown>;
        const accountsResp = await Promise.race([
          req.then((v) => v as string[]),
          new Promise<string[]>((_, rej) => setTimeout(() => rej(new Error('MetaMask prompt timed out. Click the extension icon to continue.')), 15000)),
        ]);
        accounts = accountsResp;
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

  // Create provider/signature shims
  const ethProvider = new ProviderShim(provider as unknown as Eip1193Provider)
  const network = await ethProvider.getNetwork();
  const signer = new SignerShim(accounts[0], ethProvider)
  const balance = await ethProvider.getBalance(accounts[0])

      // Update state
      this.setState({
        isConnected: true,
        isConnecting: false,
  isSwitchingNetwork: false,
        account: accounts[0],
  chainId: Number(network.chainId),
  balance: formatUnits(balance, 18),
  provider: ethProvider,
  signer
      });

      // Store connection state
      localStorage.setItem('wallet_connected', 'true');
      localStorage.setItem('wallet_account', accounts[0]);
  // Hint the app to mount wallet layer earlier next time
  try { localStorage.setItem('hka_last_wallet_connect', '1'); } catch {
    /* ignore: storage may be unavailable (private mode) */
  }

  // Ensure listeners are attached to the now-active provider
  this.setupProviderEventListeners(provider as unknown as Eip1193Provider);

  dlog('✅ Connected to MetaMask:', {
  account: accounts[0],
  chainId: Number(network.chainId),
  balance: formatUnits(balance, 18)
      });

  this.emit('connect', this.state);
      return this.state;

    } catch (error: unknown) {
  console.error('❌ Connection failed:', error);
      this.setState({ 
        isConnecting: false,
        isConnected: false 
      });
  this.emit('status', this.state);
      
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
  const provider = this.getActiveProvider();
    if (!provider) throw new Error('MetaMask provider not available');

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
  const provider = this.getActiveProvider();
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
  // Skip restore if already connected or connecting
  if (this.state.isConnected || this.state.isConnecting) return;
    const wasConnected = localStorage.getItem('wallet_connected') === 'true';
    const savedAccount = localStorage.getItem('wallet_account');

  if (wasConnected && savedAccount) {
      try {
  dlog('🔄 Restoring previous connection...');
    const provider = this.getActiveProvider();
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
        balance: formatUnits(balance, 18)
      });
      localStorage.setItem('wallet_account', account);
      this.emit('accountChanged', { account, balance: formatUnits(balance, 18) });
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
          
          const provider = new ProviderShim(sdkProvider as unknown as Eip1193Provider)
          const signer = new SignerShim(this.state.account, provider)
          
          this.setState({ 
            provider, 
            signer,
            chainId // Make sure chainId is set again
          });
          
          dlog('✅ Provider and signer refreshed for new chain');
          
          // Update balance for new chain
          const balance = await provider.getBalance(this.state.account);
          this.setState({ balance: formatUnits(balance, 18) });
          
        } catch (error) {
          console.error('❌ Error refreshing provider/signer:', error);
        }
      }
      
      this.emit('chainChanged', { chainId });
    }
  }

  // Wait until the provider actually reports the requested chain, then refresh signer/balance
  async waitForChainReady(targetChainId: number, timeoutMs: number = 15000): Promise<void> {
  const activeProvider = this.getActiveProvider();
    if (!activeProvider) throw new Error('MetaMask provider not available');

    const start = Date.now();
    let lastError: unknown = null;
    while (Date.now() - start < timeoutMs) {
      try {
        const provider = new ProviderShim(activeProvider as unknown as Eip1193Provider)
        const network = await provider.getNetwork();
        if (Number(network.chainId) === targetChainId) {
          const signer = new SignerShim(this.state.account || '', provider)
          let balanceStr = this.state.balance;
          if (this.state.account) {
            const bal = await provider.getBalance(this.state.account);
            balanceStr = formatUnits(bal, 18);
          }
          this.setState({ provider, signer, chainId: targetChainId, balance: balanceStr });
          // Small settle delay
          await new Promise(r => setTimeout(r, 120));
          return;
        }
      } catch (err) {
        lastError = err;
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

  getProvider(): ProviderShim | null { return this.state.provider }
  getSigner(): SignerShim | null { return this.state.signer }

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
