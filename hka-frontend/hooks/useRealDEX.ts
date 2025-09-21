// React Hook for Real DEX Integration
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from './useWallet';
import { realDEXService, type TokenBalance, type SwapQuote } from '../services/real-dex';
import { toast } from '../utils/lazyToast';

export const useRealDEX = () => {
  const { isConnected, chainId, provider, signer } = useWallet();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [supportedTokens, setSupportedTokens] = useState<Array<{symbol: string, name: string, address: string}>>([]);
  const [isSwapping, setIsSwapping] = useState(false);
  const initSeq = useRef(0);
  const balancesSeq = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  // Fetch real balances
  const fetchBalances = useCallback(async () => {
    if (!isConnected || !chainId) {
      setBalances([]);
      return;
    }
    const seq = ++balancesSeq.current;
    setIsLoadingBalances(true);
    const p = (async () => {
      // Ensure service on right chain
      if (!realDEXService.isInitialized() || realDEXService.getCurrentChainId() !== chainId) {
        console.log(`🔄 DEX service not ready or chainId mismatch (service: ${realDEXService.getCurrentChainId()}, wallet: ${chainId}), re-initializing...`);
        await realDEXService.initialize(chainId);
      }
      let retry = 0;
      const max = 3;
      while (retry < max) {
        try {
          // Small debounce for rapid triggers
          await new Promise(r => setTimeout(r, 200));
          if (seq !== balancesSeq.current) return; // stale
          const realBalances = await realDEXService.getTokenBalances();
          if (seq === balancesSeq.current) {
            setBalances(realBalances);
            console.log('✅ Real balances fetched:', realBalances);
          }
          return;
        } catch (err: unknown) {
          retry++;
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`⚠️ Balance fetch attempt ${retry} failed:`, msg);
          if (msg.includes('Provider network mismatch') && retry < max) {
            await new Promise(r => setTimeout(r, 400 * retry));
            await realDEXService.initialize(chainId);
          } else if (retry >= max) {
            if (seq === balancesSeq.current) {
              throw err;
            } else {
              return;
            }
          }
        }
      }
    })()
      .catch((error) => {
        if (seq === balancesSeq.current) {
          console.error('❌ Error fetching real balances after retries:', error);
          toast.error('Failed to fetch balances');
          setBalances([]);
        }
      })
      .finally(() => {
        if (seq === balancesSeq.current) setIsLoadingBalances(false);
        if (inFlight.current === p) inFlight.current = null;
      });
    inFlight.current = p;
    return p;
  }, [isConnected, chainId]);

  // Initialize service when wallet connects
  useEffect(() => {
    let cancelled = false;
  const localSeq = ++initSeq.current;
    const initializeService = async () => {
      if (!(isConnected && provider && signer && chainId)) {
        setBalances([]);
        setSupportedTokens([]);
        setIsLoadingBalances(false);
        return;
      }
      try {
        console.log(`🔄 Initializing DEX service for chain ${chainId}...`);
        setBalances([]);
        setSupportedTokens([]);
        setIsLoadingBalances(true);
        await realDEXService.initialize(chainId);
  if (cancelled || localSeq !== initSeq.current) return;
        setSupportedTokens(realDEXService.getSupportedTokens());
        console.log('✅ Real DEX service initialized');
        // Debounce a bit before first balance fetch
        await new Promise(r => setTimeout(r, 250));
  if (cancelled || localSeq !== initSeq.current) return;
        // Kick off a fetch with single-flight
        await fetchBalances();
      } catch (error) {
  if (!cancelled && localSeq === initSeq.current) {
          console.error('❌ Failed to initialize real DEX service:', error);
          toast.error('Failed to initialize DEX service');
          setIsLoadingBalances(false);
        }
      }
    };
    initializeService();
    return () => { cancelled = true; };
  }, [isConnected, provider, signer, chainId, fetchBalances]);

  // Auto-fetch balances when wallet connects or chain changes
  useEffect(() => {
    if (!(isConnected && chainId)) return;
    const t = setTimeout(() => { fetchBalances(); }, 350);
    return () => clearTimeout(t);
  }, [isConnected, chainId, fetchBalances]);

  // Get swap quote
  const getSwapQuote = useCallback(async (
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<SwapQuote | null> => {
    if (!isConnected || !chainId) {
      toast.error('Wallet not connected');
      return null;
    }

    try {
      const quote = await realDEXService.getSwapQuote(tokenIn, tokenOut, amountIn);
      return quote;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error getting swap quote:', errorMessage);
      toast.error(`Failed to get quote: ${errorMessage}`);
      return null;
    }
  }, [isConnected, chainId]);

  // Execute swap
  const executeSwap = useCallback(async (
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minimumAmountOut: string
  ): Promise<string | null> => {
    if (!isConnected || !chainId) {
      toast.error('Wallet not connected');
      return null;
    }

    setIsSwapping(true);
    try {
      toast.loading('Executing swap...', { id: 'swap' });
      
      const txHash = await realDEXService.executeSwap(
        tokenIn,
        tokenOut,
        amountIn,
        minimumAmountOut
      );

      toast.success(`Swap completed! Transaction: ${txHash.slice(0, 8)}...`, { id: 'swap' });
      
      // Refresh balances after successful swap
      setTimeout(async () => {
        try {
          const realBalances = await realDEXService.getTokenBalances();
          setBalances(realBalances);
        } catch (error) {
          console.error('❌ Error refreshing balances after swap:', error);
        }
      }, 2000);

      return txHash;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error executing swap:', errorMessage);
      toast.error(`Swap failed: ${errorMessage}`, { id: 'swap' });
      return null;
    } finally {
      setIsSwapping(false);
    }
  }, [isConnected, chainId]); // Removed fetchBalances to prevent circular dependency

  // Check token approval
  const checkTokenApproval = useCallback(async (
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<boolean> => {
    if (!isConnected || !chainId) return false;

    try {
      return await realDEXService.checkTokenApproval(tokenAddress, spenderAddress, amount);
    } catch (error) {
      console.error('❌ Error checking token approval:', error);
      return false;
    }
  }, [isConnected, chainId]);

  // Get balance for specific token
  const getTokenBalance = useCallback((tokenSymbol: string): TokenBalance | null => {
    return balances.find(balance => balance.symbol === tokenSymbol) || null;
  }, [balances]);

  // Get formatted balance for display
  const getFormattedBalance = useCallback((tokenSymbol: string): string => {
    const balance = getTokenBalance(tokenSymbol);
    if (!balance) return '0.00';
    
    const numBalance = parseFloat(balance.formattedBalance);
    if (numBalance === 0) return '0.00';
    if (numBalance < 0.0001) return '< 0.0001';
    if (numBalance < 1) return numBalance.toFixed(6);
    if (numBalance < 1000) return numBalance.toFixed(4);
    return numBalance.toFixed(2);
  }, [getTokenBalance]);

  // Check if chain is supported
  const isChainSupported = useCallback((): boolean => {
    if (!chainId) return false;
    return realDEXService.getCurrentChainInfo() !== null;
  }, [chainId]);

  // Get current chain info
  const getCurrentChainInfo = useCallback(() => {
    return realDEXService.getCurrentChainInfo();
  }, []);

  return {
    // State
    balances,
    isLoadingBalances,
    supportedTokens,
    isSwapping,
    isChainSupported: isChainSupported(),
    currentChainInfo: getCurrentChainInfo(),

    // Actions
    fetchBalances,
    getSwapQuote,
    executeSwap,
    checkTokenApproval,
    getTokenBalance,
    getFormattedBalance,

    // Computed values
    hasBalances: balances.length > 0,
    totalBalanceUSD: balances.reduce((total, balance) => {
      return total + (balance.valueUSD || 0);
    }, 0)
  };
};

export default useRealDEX;
