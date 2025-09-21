// Wallet Connection Hook
import { useState, useEffect, useCallback } from 'react';
import { walletService, type WalletState, type NetworkInfo, type WalletEventCallback } from '../services/wallet';
import { toast } from '../utils/lazyToast';

export const useWallet = () => {
  const [state, setState] = useState<WalletState>(walletService.getState());
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize wallet service on mount
  useEffect(() => {
    let mounted = true;

    const initWallet = async () => {
      try {
        await walletService.initialize();
        if (mounted) {
          setState(walletService.getState());
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
        if (mounted) {
          toast.error('Failed to initialize wallet service');
          setIsInitialized(true); // Still set as initialized to prevent infinite loading
        }
      }
    };

    initWallet();

    return () => {
      mounted = false;
    };
  }, []);

  // Setup event listeners
  useEffect(() => {
    const handleConnect = (walletState: WalletState) => {
      setState(walletState);
      toast.success(`Connected to ${walletState.account?.slice(0, 6)}...${walletState.account?.slice(-4)}`);
    };

    const handleDisconnect = () => {
      setState(walletService.getState());
      toast.info('Wallet disconnected');
    };

    const handleAccountChanged = (data: { account: string; balance: string }) => {
      setState(walletService.getState());
      toast.info(`Account changed to ${data.account.slice(0, 6)}...${data.account.slice(-4)}`);
    };

    const handleChainChanged = () => {
      console.log('🔗 Chain changed event received, updating state...');
      setState(walletService.getState());
      const network = walletService.getCurrentNetwork();
      if (network) {
        console.log(`✅ Network updated to: ${network.name}`);
        toast.info(`Network changed to ${network.name}`);
      }
    };

    const handleError = (data: { message: string; error?: unknown }) => {
      toast.error(data.message);
      console.error('Wallet error:', data.error);
    };

    const handleStatus = (walletState: WalletState) => {
      setState(walletState);
    };

    // Subscribe to events
    walletService.on('connect', handleConnect as WalletEventCallback);
    walletService.on('disconnect', handleDisconnect as WalletEventCallback);
    walletService.on('accountChanged', handleAccountChanged as WalletEventCallback);
    walletService.on('chainChanged', handleChainChanged as WalletEventCallback);
    walletService.on('error', handleError as WalletEventCallback);
  walletService.on('status', handleStatus as WalletEventCallback);

    // Cleanup
    return () => {
      walletService.off('connect', handleConnect as WalletEventCallback);
      walletService.off('disconnect', handleDisconnect as WalletEventCallback);
      walletService.off('accountChanged', handleAccountChanged as WalletEventCallback);
      walletService.off('chainChanged', handleChainChanged as WalletEventCallback);
      walletService.off('error', handleError as WalletEventCallback);
  walletService.off('status', handleStatus as WalletEventCallback);
    };
  }, []);

  // Connection functions
  const connect = useCallback(async () => {
    try {
      await walletService.connect();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await walletService.disconnect();
    } catch (error: unknown) {
      console.error('Disconnect error:', error);
    }
  }, []);

  const switchNetwork = useCallback(async (chainId: number) => {
    try {
      await walletService.switchNetwork(chainId);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch network';
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  // Helper functions
  const getSupportedNetworks = useCallback((): NetworkInfo[] => {
    return walletService.getSupportedNetworks();
  }, []);

  const getCurrentNetwork = useCallback((): NetworkInfo | null => {
    return walletService.getCurrentNetwork();
  }, []);

  const getContractAddresses = useCallback((chainId?: number) => {
    return walletService.getContractAddresses(chainId);
  }, []);

  const isNetworkSupported = useCallback((chainId: number): boolean => {
    return walletService.isNetworkSupported(chainId);
  }, []);

  // Format balance for display
  const getFormattedBalance = useCallback((decimals: number = 4): string => {
    if (!state.balance) return '0';
    const balance = parseFloat(state.balance);
    return balance.toFixed(decimals);
  }, [state.balance]);

  // Get short address for display
  const getShortAddress = useCallback((): string => {
    if (!state.account) return '';
    return `${state.account.slice(0, 6)}...${state.account.slice(-4)}`;
  }, [state.account]);

  return {
    // State
  ...state,
    isInitialized,
    
    // Actions
    connect,
    disconnect,
    switchNetwork,
    
    // Helpers
    getSupportedNetworks,
    getCurrentNetwork,
    getContractAddresses,
    isNetworkSupported,
    getFormattedBalance,
    getShortAddress,
    
    // Computed properties
  isSupported: state.chainId ? isNetworkSupported(state.chainId) : false,
    networkName: getCurrentNetwork()?.name || 'Unknown Network'
  };
};

export default useWallet;
