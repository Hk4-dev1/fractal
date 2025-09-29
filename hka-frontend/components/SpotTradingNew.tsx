import { useState, useEffect, useCallback, useRef } from 'react';
// Dynamic framer-motion (lazy) – keeps heavy animation lib out of initial bundle
import { motion, AnimatePresence, loadFramerMotion } from './fm';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ArrowLeftRight, ChevronDown, RefreshCw, Settings, Zap, AlertCircle } from 'lucide-react';
import { toast } from '../utils/lazyToast';
import { useRealDEX } from '../hooks/useRealDEX';
import { useWallet } from '../hooks/useWallet';
import { NETWORKS } from '../services/contract-config';
import { SwapQuote } from '../services/real-dex';
import { parseUnits, formatUnits } from '../services/viemAdapter';
import { quoteRoute, sendRouteLazy as sendRoute, formatFeeWeiToEth, isRouteSupported, cancelOrderLazy as cancelOrder } from '../src/services/crosschainRouter';
import { getReceiptStatus, checkWiring, findDelivery } from '../src/services/ccStatus'
import { getEthUsdPriceNumber } from '../src/services/chainlink';
import { envHealthSummary } from '../src/services/envHealth';
import { getExplorerUrl } from '../services/contracts';
import { ChainLogo } from './ui/chain-logo';
import { TokenLogo } from './ui/token-logo';
import { getAmmQuoteOnChain } from '../src/services/ammQuoteRemote';
import { Skeleton } from './ui/skeleton';
import { getTokenFormattedBalance } from '../src/services/balancesRemote';

// Slippage tolerance options
const SLIPPAGE_OPTIONS = ['0.1', '0.5', '1.0', '3.0'];

//

export function SpotTradingNew() {
  // Defer framer-motion load until first real interaction (pointer/focus/click)
  const interactionArmedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const fire = () => { if (!interactionArmedRef.current) { interactionArmedRef.current = true; loadFramerMotion(true); } };
    const el = rootRef.current;
    if (!el) return;
    el.addEventListener('pointerenter', fire, { once: true, passive: true });
    el.addEventListener('click', fire, { once: true });
    el.addEventListener('focusin', fire, { once: true });
    return () => {
      el.removeEventListener('pointerenter', fire);
      el.removeEventListener('click', fire);
      el.removeEventListener('focusin', fire);
    };
  }, []);
  const { isConnected, networkName, chainId, switchNetwork, account, isSwitchingNetwork } = useWallet();
  const { 
    isLoadingBalances, 
    supportedTokens, 
    isSwapping,
    isChainSupported,
    currentChainInfo,
    getSwapQuote,
    executeSwap,
  getTokenBalance,
    getFormattedBalance,
    fetchBalances
  } = useRealDEX();
  
  // const isMobile = useIsMobile();
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [ccDebug, setCcDebug] = useState(false);
  type CrossQuoteExtras = {
    routeType?: 'direct' | 'multihop';
    lzNativeFeeWei?: string;
    lzTokenFeeWei?: string;
  legs?: Array<{ from: string; to: string; nativeFeeWei: string; lzTokenFeeWei?: string }>;
  };
  const [lastQuote, setLastQuote] = useState<(SwapQuote & CrossQuoteExtras) | null>(null);
  // isSwitchingNetwork comes from wallet hook state
  const [fromChain, setFromChain] = useState<number>(chainId || NETWORKS.ETHEREUM_SEPOLIA.chainId);
  const [toChain, setToChain] = useState<number>(NETWORKS.ARBITRUM_SEPOLIA.chainId);
  const [showDetails, setShowDetails] = useState(false);
  const [showLegs, setShowLegs] = useState(false);
  const [swapAnim, setSwapAnim] = useState(false);
  const [ratePulse, setRatePulse] = useState(false);
  const [feePulse, setFeePulse] = useState(false);
  const [isInputActive, setIsInputActive] = useState(false);
  const [routeOk, setRouteOk] = useState(true);
  const [routeReason, setRouteReason] = useState<string | undefined>(undefined);
  const prefsLoadedRef = useRef(false);
  // Cleanup status polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null } }
  }, [])
  // Chainlink oracle state
  const [ethUsdPrice, setEthUsdPrice] = useState<number | null>(null);
  // Env health notice
  const [envWarning, setEnvWarning] = useState<string | null>(null);
  type SentTxInfo =
    | { type: 'direct'; txHash: string; fromChainId: number; toChainId: number; orderId: string }
    | { type: 'multihop'; leg1: string; leg2: string; fromChainId: number; hopChainId: number; toChainId: number; orderId: string };
  const [lastTxInfo, setLastTxInfo] = useState<SentTxInfo | null>(null);
  const [ccStatus, setCcStatus] = useState<null | {
    wiring?: { escrowRouterOk: boolean; routerPeerOk: boolean; routerEscrowOk: boolean | null }
    source?: { status: 'pending' | 'confirmed' | 'failed'; blockNumber?: bigint }
    delivery?: { delivered: boolean; txHash?: string }
    error?: string
  }>(null)
  // Polling timer
  const pollRef = useRef<number | null>(null)
  
  // Debug: log state changes
  useEffect(() => {
    console.log('🐛 Wallet state update:', { 
      isConnected, 
      chainId, 
      networkName,
      isChainSupported,
      currentChainInfo: currentChainInfo?.name 
    });
  }, [isConnected, chainId, networkName, isChainSupported, currentChainInfo]);
  
  // Network switching handler (memoized)
  const handleNetworkSwitch = useCallback(async (newChainId: number) => {
    if (isSwitchingNetwork) return;
    try {
      toast.loading('Switching network...', { id: 'network-switch' });
      await switchNetwork(newChainId);
      // Reset form when network changes
      setFromAmount('');
      setToAmount('');
      setLastQuote(null);
      toast.success('Network switched', { id: 'network-switch' });
      // Balances will auto-refresh via useRealDEX after chainId updates
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch network';
      toast.error(errorMessage, { id: 'network-switch' });
    }
  }, [isSwitchingNetwork, switchNetwork]);
  
  // Initialize default tokens when supported tokens are available
  useEffect(() => {
    // Load saved preferences once (after tokens are available)
    if (!prefsLoadedRef.current && supportedTokens.length > 0) {
      try {
        const savedRaw = localStorage.getItem('swap.prefs');
        if (savedRaw) {
          const saved = JSON.parse(savedRaw) as Partial<{
            fromChain: number; toChain: number; fromToken: string; toToken: string; slippage: string;
          }>;
          if (saved.fromChain) {
            setFromChain(saved.fromChain);
            // best-effort auto switch when prefs load
            setTimeout(() => {
              if (isConnected) handleNetworkSwitch(saved.fromChain!);
            }, 0);
          }
          if (saved.toChain) setToChain(saved.toChain);
          if (saved.slippage) setSlippage(saved.slippage);
          // Only set tokens if they exist in supported list
          if (saved.fromToken && supportedTokens.some(t => t.address === saved.fromToken)) setFromToken(saved.fromToken);
          if (saved.toToken && supportedTokens.some(t => t.address === saved.toToken)) setToToken(saved.toToken);
        }
  } catch { /* noop: localStorage not available or corrupted */ }
      finally {
        prefsLoadedRef.current = true;
      }
    }
    // Fallback defaults if nothing set
    if (supportedTokens.length > 0 && !fromToken) {
      setFromToken(supportedTokens[0].address);
    }
    if (supportedTokens.length > 1 && !toToken) {
      setToToken(supportedTokens[1].address);
    }
  }, [supportedTokens, fromToken, toToken, isConnected, handleNetworkSwitch]);

  // Persist preferences
  useEffect(() => {
    try {
      if (!fromToken || !toToken) return;
      const payload = { fromChain, toChain, fromToken, toToken, slippage };
      localStorage.setItem('swap.prefs', JSON.stringify(payload));
  } catch { /* noop: localStorage write may fail in private mode */ }
  }, [fromChain, toChain, fromToken, toToken, slippage]);
  
  // Listen to wallet chainId changes for immediate UI updates (do not force fromChain)
  useEffect(() => {
    console.log(`🔗 ChainId changed to: ${chainId}, updating UI...`);
    // Reset form state when chain changes
    setFromAmount('');
    setToAmount('');
    setLastQuote(null);
  }, [chainId]);

  // Auto-switch wallet network to match selected From chain
  useEffect(() => {
    if (!isConnected || !fromChain) return;
    if (isSwitchingNetwork) return;
    if (chainId === fromChain) return;
    const t = setTimeout(() => {
      // Attempt automatic network switch (debounced)
      handleNetworkSwitch(fromChain);
    }, 350);
    return () => clearTimeout(t);
  }, [fromChain, isConnected, isSwitchingNetwork, chainId, handleNetworkSwitch]);
  
  // Get token data by address
  const getTokenByAddress = useCallback((address: string) => {
    return supportedTokens.find(token => token.address === address);
  }, [supportedTokens]);
  
  const toTokenData = getTokenByAddress(toToken);
  const isCrossChain = fromChain !== toChain;
  const walletOnFromChain = !!chainId && chainId === fromChain;

  const chainIdToUiKey = (id: number): 'ethereum' | 'arbitrum' | 'optimism' | 'base' => {
    switch (id) {
      case 11155111:
        return 'ethereum';
      case 421614:
        return 'arbitrum';
      case 11155420:
        return 'optimism';
      case 84532:
        return 'base';
      default:
        return 'ethereum';
    }
  };
  // Probe if cross-chain route is supported (debounced + single-flight)
  useEffect(() => {
    if (!isCrossChain) { setRouteOk(true); setRouteReason(undefined); return; }
    const fromUi = chainIdToUiKey(fromChain);
    const toUi = chainIdToUiKey(toChain);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await isRouteSupported(fromUi, toUi);
        if (!cancelled) { setRouteOk(res.ok); setRouteReason(res.reason); }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) { setRouteOk(false); setRouteReason(msg || 'unknown'); }
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isCrossChain, fromChain, toChain]);

  // On mount: surface RPC env health to help avoid silent timeouts
  useEffect(() => {
    try {
      const summary = envHealthSummary();
      setEnvWarning(summary);
    } catch {
      // ignore
    }
  }, []);


  // const prettyChain = (id: number) => Object.values(NETWORKS).find(n => n.chainId === id)?.name.replace(' Sepolia', '') || `${id}`;

  // Local fee estimates (bps)
  const ESCROW_FEE_BPS = 30; // 0.30%
  const PROTOCOL_FEE_BPS = 5; // 0.05%
  const AMM_FEE_BPS = 20; // 0.20%
  // const calcBps = (amt: number, bps: number) => (amt * bps) / 10_000;

  // Derived fee amounts (legacy float helpers kept for reference, not used in UI)

  // Wei-precise fee helpers (handle tiny amounts better)
  const getFromTokenSymbol = () => (getTokenByAddress(fromToken)?.symbol || '').toUpperCase();
  const getDecimalsBySymbol = (sym: string) => (sym === 'USDC' ? 6 : 18);
  // const formatFeeFromWei = (wei: bigint, decimals: number) => ethers.formatUnits(wei, decimals);
  const computeWeiFee = (amountStr: string, bps: number, decimals: number) => {
    try {
  const wei = parseUnits((amountStr || '0').replace(',', '.'), decimals);
      return (wei * BigInt(bps)) / 10_000n;
    } catch {
      return 0n;
    }
  };
  const fromSymUp = getFromTokenSymbol();
  const fromDecimals = getDecimalsBySymbol(fromSymUp);
  const ammFeeWei = computeWeiFee(fromAmount, AMM_FEE_BPS, fromDecimals);
  const escrowFeeWei = computeWeiFee(fromAmount, ESCROW_FEE_BPS, fromDecimals);
  const protocolFeeWei = computeWeiFee(fromAmount, PROTOCOL_FEE_BPS, fromDecimals);
  const totalDexFeeWeiSameChain = computeWeiFee(fromAmount, AMM_FEE_BPS + PROTOCOL_FEE_BPS, fromDecimals); // 0.25%
  const totalDexFeeWeiCrossChain = computeWeiFee(fromAmount, AMM_FEE_BPS + ESCROW_FEE_BPS + PROTOCOL_FEE_BPS, fromDecimals); // 0.55%

  // Pretty name for ChainKey values used in cross-chain legs
  const prettyChainKey = (key: string) => {
    switch (key) {
      case 'ethereum-sepolia':
        return 'Ethereum';
      case 'arbitrum-sepolia':
        return 'Arbitrum';
      case 'optimism-sepolia':
        return 'Optimism';
      case 'base-sepolia':
        return 'Base';
      default:
        return key;
    }
  };

  const prettyChainId = (id: number) => {
    const n = Object.values(NETWORKS).find((n) => n.chainId === id)?.name;
    return n ? n.replace(' Sepolia', '') : `${id}`;
  };

  // Fetch Chainlink ETH/USD price for the source chain (refreshed periodically)
  useEffect(() => {
    let cancelled = false;
  let timer: number;
    const fetchPrice = async () => {
      try {
        const p = await getEthUsdPriceNumber(fromChain);
        if (!cancelled) setEthUsdPrice(p);
      } catch {
        if (!cancelled) setEthUsdPrice(null);
      }
    };
    fetchPrice();
  timer = window.setInterval(fetchPrice, 30_000);
  return () => { cancelled = true; window.clearInterval(timer); };
  }, [fromChain]);

  // Local cache for remote destination balance
  const [destBalance, setDestBalance] = useState<string>('0.00');
  const [destBalLoading, setDestBalLoading] = useState<boolean>(false);
  const destBalanceSeq = useRef(0);

  // Get balance for a token on the source (wallet) chain using realDEX balances
  const getSourceBalance = (tokenAddress: string): string => {
    if (isLoadingBalances) return '...';
    const token = supportedTokens.find(t => t.address === tokenAddress);
    if (!token) return '0.00';
    return getFormattedBalance(token.symbol);
  };

  // Fetch destination balance remotely (read-only) when To chain or token changes
  useEffect(() => {
    const seq = ++destBalanceSeq.current;
    const run = async () => {
      if (!isCrossChain) { setDestBalance(''); return; }
      if (!toToken || !account) { setDestBalance('0.00'); return; }
      const token = supportedTokens.find(t => t.address === toToken);
      if (!token) { setDestBalance('0.00'); return; }
      setDestBalLoading(true);
      // Slow-path feedback: if balance fetch takes >1.5s, show a toast
      const slowId = `dest-bal-${seq}`;
      const slowTimer = setTimeout(() => {
        if (seq === destBalanceSeq.current) {
          toast.loading('Fetching destination balance…', { id: slowId });
        }
      }, 1500);
      try {
        // small debounce to batch rapid changes
        await new Promise(r => setTimeout(r, 250));
        if (seq !== destBalanceSeq.current) return; // single-flight guard
        const bal = await getTokenFormattedBalance({ chainId: toChain, account, symbol: token.symbol });
        if (seq === destBalanceSeq.current) setDestBalance(bal);
  } catch {
        if (seq === destBalanceSeq.current) setDestBalance('0.00');
      } finally {
        clearTimeout(slowTimer);
        toast.dismiss(slowId);
        if (seq === destBalanceSeq.current) setDestBalLoading(false);
      }
    };
    run();
  }, [isCrossChain, toChain, toToken, account, supportedTokens]);

  // Handle getting swap quote (same-chain or cross-chain)
  const handleGetQuote = useCallback(async () => {
    const amtStr = (fromAmount || '').replace(',', '.').trim();
    const amtNum = parseFloat(amtStr || '0');
    if (!amtStr || !fromToken || !toToken || amtNum <= 0) {
      setToAmount('');
      return;
    }

    // Prevent same-token swaps (AMM likely reverts / not meaningful)
    if (fromToken === toToken && fromChain === toChain) {
      setToAmount('');
      setLastQuote(null);
      toast.message('Select different tokens for a swap');
      return;
    }

    // Restrict cross-chain to ETH/WETH/USDC token pairs for now
    const allowedCcSymbols = new Set(['ETH', 'WETH', 'USDC']);
    const fromSym = (getTokenByAddress(fromToken)?.symbol || '').toUpperCase();
    const toSym = (getTokenByAddress(toToken)?.symbol || '').toUpperCase();

    if (isCrossChain) {
      if (!allowedCcSymbols.has(fromSym) || !allowedCcSymbols.has(toSym)) {
        setToAmount('');
        setLastQuote(null);
        toast.error('Cross-chain supports ETH/WETH and USDC only for now');
        return;
      }
    }

    setQuoteLoading(true);
    try {
      if (!isCrossChain) {
        try {
          const quote = await getSwapQuote(fromToken, toToken, amtStr);
          if (quote) {
            setToAmount(quote.amountOut);
            setLastQuote(quote);
          } else {
            // Try on-chain AMM quote before oracle fallback
            const fromSym = getTokenByAddress(fromToken)?.symbol || '';
            const toSym = getTokenByAddress(toToken)?.symbol || '';
            try {
              const amm = await getAmmQuoteOnChain({
                chainId: fromChain,
                tokenInSymbol: fromSym,
                tokenOutSymbol: toSym,
                amountIn: fromAmount,
                subtractFeeBps: PROTOCOL_FEE_BPS, // AMM already prices its fee; subtract protocol only on same-chain
              });
              const minRecv = parseFloat(amm.amountOut) * (1 - parseFloat(slippage) / 100);
              setToAmount(amm.amountOut);
              setLastQuote({
                amountIn: amtStr,
                amountOut: amm.amountOut,
                minimumReceived: String(minRecv),
                priceImpact: amm.priceImpactPercent,
                path: [fromToken, toToken],
              });
            } catch {
              // Fallback to Chainlink for ETH/WETH <-> USDC pairs
              const upFrom = fromSym.toUpperCase();
              const upTo = toSym.toUpperCase();
              const isEthUsdc = ethUsdPrice && ((upFrom === 'ETH' || upFrom === 'WETH') && upTo === 'USDC');
              const isUsdcEth = ethUsdPrice && (upFrom === 'USDC' && (upTo === 'ETH' || upTo === 'WETH'));
              if (ethUsdPrice && (isEthUsdc || isUsdcEth)) {
                const amt = amtNum;
                const grossOut = isEthUsdc ? amt * ethUsdPrice! : amt / ethUsdPrice!;
                const feeBps = AMM_FEE_BPS + PROTOCOL_FEE_BPS; // same-chain: no escrow fee
                const netOut = grossOut * (1 - feeBps / 10_000);
                const minRecv = netOut * (1 - parseFloat(slippage) / 100);
                setToAmount(netOut.toString());
                setLastQuote({
                  amountIn: amtStr,
                  amountOut: netOut.toString(),
                  minimumReceived: minRecv.toString(),
                  priceImpact: 0,
                  path: [fromToken, toToken],
                });
                toast.message('Oracle-based estimate shown');
              } else {
                setToAmount('');
                setLastQuote(null);
                toast.error('Quote unavailable. Pair may be unsupported or amount too small.');
              }
            }
          }
        } catch (e: unknown) {
          console.error('Same-chain quote failed:', e);
          const msg = (e as Error)?.message || ''
          if (/Missing RPC URL|timeout|ECONN|network/.test(msg)) {
            toast.error('RPC issue while quoting. Check .env RPCs or try again.');
          }
          // Fallback to Chainlink for ETH/WETH <-> USDC
          const fromSym = getTokenByAddress(fromToken)?.symbol?.toUpperCase();
          const toSym = getTokenByAddress(toToken)?.symbol?.toUpperCase();
          const isEthUsdc = ethUsdPrice && ((fromSym === 'ETH' || fromSym === 'WETH') && toSym === 'USDC');
          const isUsdcEth = ethUsdPrice && (fromSym === 'USDC' && (toSym === 'ETH' || toSym === 'WETH'));
          if (ethUsdPrice && (isEthUsdc || isUsdcEth)) {
            const amt = amtNum;
            const grossOut = isEthUsdc ? amt * ethUsdPrice! : amt / ethUsdPrice!;
            const feeBps = AMM_FEE_BPS + PROTOCOL_FEE_BPS;
            const netOut = grossOut * (1 - feeBps / 10_000);
            const minRecv = netOut * (1 - parseFloat(slippage) / 100);
            setToAmount(netOut.toString());
            setLastQuote({
              amountIn: amtStr,
              amountOut: netOut.toString(),
              minimumReceived: minRecv.toString(),
              priceImpact: 0,
              path: [fromToken, toToken],
            });
            toast.message('Oracle-based estimate shown');
          } else {
            setToAmount('');
            setLastQuote(null);
            toast.error('Quote failed on this chain. Try a different pair or amount.');
          }
        }
      } else {
        // Cross-chain quote path
        if (!routeOk) {
          setToAmount('');
          setLastQuote(null);
          toast.error(`Route not configured yet for this pair${routeReason ? `: ${routeReason}` : ''}`);
          return;
        }
  const fromUi = chainIdToUiKey(fromChain);
  const toUi = chainIdToUiKey(toChain);
  const fromTokenData = getTokenByAddress(fromToken);
  const toTokenDataLocal = getTokenByAddress(toToken);
  // Use decimals-aware units for payload amount (fee quote sizing)
  const amtFromSym = (fromTokenData?.symbol || 'ETH').toUpperCase();
  const amtDecimals = amtFromSym === 'USDC' ? 6 : 18;
  const amountWei = parseUnits(amtStr, amtDecimals);
        const res = await quoteRoute({
          fromUiKey: fromUi,
          toUiKey: toUi,
          fromToken: fromTokenData?.symbol || 'TOKEN',
          toToken: toTokenDataLocal?.symbol || 'TOKEN',
          amount: amountWei,
        });
        try {
          // Destination-chain output estimation
          const srcSym = (fromTokenData?.symbol || 'ETH').toUpperCase();
          const dstOutSymRaw = (toTokenDataLocal?.symbol || 'ETH').toUpperCase();
          const dstInSym = srcSym === 'ETH' ? 'WETH' : srcSym;
          const dstOutSym = dstOutSymRaw === 'ETH' ? 'WETH' : dstOutSymRaw;

          // If same-asset bridging (e.g., ETH->ETH or USDC->USDC), apply total DEX fee of 0.55% flat (escrow+AMM+protocol)
          if (dstInSym === dstOutSym) {
            // Wei-precise 0.55% total DEX fee for same-asset bridging
            const TOTAL_DEX_FEE_BPS = ESCROW_FEE_BPS + AMM_FEE_BPS + PROTOCOL_FEE_BPS; // 55 bps
            const fromSymUp = (fromTokenData?.symbol || 'ETH').toUpperCase();
            const decimals = fromSymUp === 'USDC' ? 6 : 18; // extend if supporting more tokens
            const amountWei = parseUnits(amtStr, decimals);
            const feeDen = 10_000n;
            const netWei = (amountWei * (feeDen - BigInt(TOTAL_DEX_FEE_BPS))) / feeDen;
            const slippageBps = Math.round(parseFloat(slippage || '0') * 100);
            const minRecvWei = (netWei * (feeDen - BigInt(slippageBps))) / feeDen;
            const netStr = formatUnits(netWei, decimals);
            const minRecvStr = formatUnits(minRecvWei, decimals);
            setToAmount(netStr);
            setLastQuote({
              amountIn: amtStr,
              amountOut: netStr,
              minimumReceived: minRecvStr,
              priceImpact: 0,
              path: [fromToken, toToken],
              routeType: res.route,
              lzNativeFeeWei: res.nativeFee,
              lzTokenFeeWei: res.lzTokenFee,
              legs: res.legs?.map(l => ({ from: l.from, to: l.to, nativeFeeWei: l.nativeFee, lzTokenFeeWei: l.lzTokenFee })),
            });
            toast.success('Quote (same-asset bridge) OK');
          } else {
            // Cross-asset swap on destination AMM: subtract external fees, AMM fee handled by AMM
            const subtractBps = ESCROW_FEE_BPS + PROTOCOL_FEE_BPS; // 35 bps
            const dstQuote = await getAmmQuoteOnChain({
              chainId: toChain,
              tokenInSymbol: dstInSym,
              tokenOutSymbol: dstOutSym,
              amountIn: fromAmount,
              subtractFeeBps: subtractBps,
            });
            const estimatedOutput = parseFloat(dstQuote.amountOut);
            setToAmount(dstQuote.amountOut);
            setLastQuote({
              amountIn: amtStr,
              amountOut: dstQuote.amountOut,
              minimumReceived: (estimatedOutput * (1 - parseFloat(slippage) / 100)).toString(),
              priceImpact: dstQuote.priceImpactPercent,
              path: [fromToken, toToken],
              routeType: res.route,
              lzNativeFeeWei: res.nativeFee,
              lzTokenFeeWei: res.lzTokenFee,
              legs: res.legs?.map(l => ({ from: l.from, to: l.to, nativeFeeWei: l.nativeFee, lzTokenFeeWei: l.lzTokenFee })),
            });
            toast.success(res.route === 'direct' ? 'Quote (direct) OK' : 'Quote via ETH (multihop) OK');
          }
  } catch (e: unknown) {
    console.warn('Dest-chain quote failed, using fallback estimate:', e);
          // Prefer Chainlink for ETH/WETH <-> USDC as a fallback
          const fromSym = (fromTokenData?.symbol || 'ETH').toUpperCase();
          const toSym = (toTokenDataLocal?.symbol || 'USDC').toUpperCase();
          let estNum: number;
          if (ethUsdPrice && ((fromSym === 'ETH' || fromSym === 'WETH') && toSym === 'USDC')) {
            estNum = amtNum * ethUsdPrice;
          } else if (ethUsdPrice && (fromSym === 'USDC' && (toSym === 'ETH' || toSym === 'WETH'))) {
            estNum = amtNum / ethUsdPrice;
          } else {
            estNum = amtNum;
          }
          // Apply total fees for cross-chain
          estNum = estNum * (1 - (AMM_FEE_BPS + ESCROW_FEE_BPS + PROTOCOL_FEE_BPS) / 10_000);
          const fallbackOut = estNum.toString();
          setToAmount(fallbackOut);
          setLastQuote({
            amountIn: amtStr,
            amountOut: fallbackOut,
            minimumReceived: (estNum * (1 - parseFloat(slippage) / 100)).toString(),
            priceImpact: 0.5,
            path: [fromToken, toToken],
            routeType: res.route,
            lzNativeFeeWei: res.nativeFee,
            lzTokenFeeWei: res.lzTokenFee,
            legs: res.legs?.map(l => ({ from: l.from, to: l.to, nativeFeeWei: l.nativeFee, lzTokenFeeWei: l.lzTokenFee })),
          });
          toast.message('Estimated output shown (destination quote unavailable)');
        }
      }
    } catch (error) {
      console.error('Quote error:', error);
      setToAmount('');
      setLastQuote(null);
      toast.error('Quote unavailable. Try adjusting amount or pair.');
    } finally {
      setQuoteLoading(false);
    }
  }, [fromAmount, fromToken, toToken, getSwapQuote, isCrossChain, fromChain, toChain, slippage, ethUsdPrice, routeOk, getTokenByAddress, routeReason]);

  // Auto-quote with debounce and single-flight seq guard
  const quoteSeq = useRef(0);
  useEffect(() => {
    const seq = ++quoteSeq.current;
    const t = setTimeout(async () => {
      if (!fromAmount || !fromToken || !toToken) return;
      if (seq !== quoteSeq.current) return;
      await handleGetQuote();
    }, 500);
    return () => { clearTimeout(t); };
  }, [fromAmount, fromToken, toToken, handleGetQuote]);

  // Flash rate when output updates
  useEffect(() => {
    if (parseFloat(fromAmount || '0') > 0 && parseFloat(toAmount || '0') > 0) {
      setRatePulse(true);
      const t = setTimeout(() => setRatePulse(false), 220);
      return () => clearTimeout(t);
    }
  }, [toAmount, fromAmount]);

  // Flash fees when quote or amount changes
  useEffect(() => {
    if (lastQuote) {
      setFeePulse(true);
      const t = setTimeout(() => setFeePulse(false), 220);
      return () => clearTimeout(t);
    }
  }, [lastQuote, fromAmount]);

  // Handle swap execution
  const handleSwap = async () => {
    if (!lastQuote || !fromAmount) {
      toast.error('No quote available');
      return;
    }

    try {
      if (isCrossChain) {
        const fromUi = chainIdToUiKey(fromChain);
        const toUi = chainIdToUiKey(toChain);
        const fromTokenData = getTokenByAddress(fromToken);
        const toTokenDataLocal = getTokenByAddress(toToken);
        const fromSymUp = (fromTokenData?.symbol || 'ETH').toUpperCase();
        const amtDecimals = fromSymUp === 'USDC' ? 6 : 18;
  const amountWei = parseUnits(fromAmount, amtDecimals);
        // Compute slippage-protected minOut for destination token, and surface in toast
        // Compute slippage-protected minOut for destination token
        const toSymUp = (toTokenDataLocal?.symbol || 'USDC').toUpperCase();
        const toDecimals = toSymUp === 'USDC' ? 6 : 18;
        const minOutStr = lastQuote.minimumReceived || toAmount;
        const minOutWei = parseUnits(minOutStr, toDecimals);
        const minOutPretty = (() => {
          const n = Number(minOutStr || '0');
          return isFinite(n) ? n.toFixed(6) : minOutStr;
        })();
        toast.loading(`Sending cross-chain… Min receive: ${minOutPretty} ${toSymUp}`, { id: 'cc-swap' });
        const res = await sendRoute({
          fromUiKey: fromUi,
          toUiKey: toUi,
          fromToken: fromTokenData?.symbol || 'TOKEN',
          toToken: toTokenDataLocal?.symbol || 'TOKEN',
          amount: amountWei,
          minOut: minOutWei,
          debug: ccDebug ? (info) => { try { console.debug('[cc-debug]', info) } catch {} } : undefined,
        });
  toast.success(`Sent (min ${minOutPretty} ${toSymUp} protected): ${res.txHash.slice(0, 10)}…`, { id: 'cc-swap' });
  setLastTxInfo({ type: 'direct', txHash: res.txHash, fromChainId: fromChain, toChainId: toChain, orderId: res.orderId });
        // Kick off status polling
        try {
          setCcStatus({})
          // 1) wiring
          const wiring = await checkWiring({ fromUiKey: chainIdToUiKey(fromChain), toUiKey: chainIdToUiKey(toChain) })
          setCcStatus(s => ({ ...(s||{}), wiring }))
          // 2) source receipt + 3) delivery polling
          const start = Date.now()
          const doPoll = async () => {
            try {
              const source = await getReceiptStatus({ chainId: fromChain, txHash: res.txHash as `0x${string}` })
              setCcStatus(s => ({ ...(s||{}), source }))
              if (source.status === 'confirmed') {
                const me = account as `0x${string}`
                const delivery = await findDelivery({ toUiKey: chainIdToUiKey(toChain), recipient: me, minBlock: source.blockNumber, maxLookbackBlocks: 7000n })
                if (delivery.delivered) {
                  setCcStatus(s => ({ ...(s||{}), delivery: { delivered: true, txHash: delivery.matchedLog?.txHash } }))
                  if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null }
                  return
                }
              }
              if (Date.now() - start > 7 * 60 * 1000) { // stop after ~7 minutes
                if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null }
                return
              }
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              setCcStatus(s => ({ ...(s||{}), error: msg }))
            }
          }
          await doPoll()
          if (pollRef.current) window.clearInterval(pollRef.current)
          pollRef.current = window.setInterval(doPoll, 5000)
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setCcStatus({ error: msg })
        }
        setFromAmount('');
        setToAmount('');
        setLastQuote(null);
      } else {
        // Same-chain: surface minOut in toast too
        const toSymUp = (getTokenByAddress(toToken)?.symbol || 'TOKEN').toUpperCase();
        const minOutStr = lastQuote.minimumReceived || toAmount;
        const minOutPretty = (() => {
          const n = Number(minOutStr || '0');
          return isFinite(n) ? n.toFixed(6) : minOutStr;
        })();
        toast.loading(`Swapping… Min receive: ${minOutPretty} ${toSymUp}`, { id: 'sc-swap' });
        const txHash = await executeSwap(
          fromToken,
          toToken,
          fromAmount,
          lastQuote.minimumReceived
        );
        if (txHash) {
          toast.success(`Swap sent (min ${minOutPretty} ${toSymUp} protected): ${txHash.slice(0,10)}…`, { id: 'sc-swap' });
          setFromAmount('');
          setToAmount('');
          setLastQuote(null);
        }
      }
    } catch (error) {
      console.error('Swap error:', error);
  const message = (error as Error)?.message || 'Swap failed';
  toast.error(message);
    }
  };

  // Swap tokens
  const swapTokens = () => {
  setSwapAnim(true);
  setTimeout(() => setSwapAnim(false), 180);
    const tempToken = fromToken;
    const tempAmount = toAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(tempAmount);
    setToAmount('');
    setLastQuote(null);
    // Swap chains too for 1inch-style flipping
    setFromChain((prev) => {
      const oldFrom = prev;
      setToChain(oldFrom);
      return toChain;
    });
  };

  // Set max balance using raw precise balance from useRealDEX
  const setMaxBalance = () => {
    try {
      const token = supportedTokens.find(t => t.address === fromToken);
      if (!token) return;
      // Prefer raw precise balance from getTokenBalance
      const balEntry = getTokenBalance(token.symbol);
      if (balEntry) {
        // Use full precision string, but trim trailing zeros
        const raw = balEntry.formattedBalance;
        const normalized = raw.replace(/\.0+$/, '');
        setFromAmount(normalized);
        return
      }
      // Fallback to formatted display balance but clean special case
      let display = getSourceBalance(fromToken);
      if (display.startsWith('<')) {
        display = '0.0001';
      }
      setFromAmount(display.replace(',', '.'));
    } catch {
      // no-op
    }
  };

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-12 h-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium mb-2">Connect Your Wallet</h3>
                <p className="text-muted-foreground">
                  Please connect your wallet to start trading
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isChainSupported) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-12 h-12 text-yellow-500" />
              <div>
                <h3 className="text-lg font-medium mb-2">Unsupported Network</h3>
                <p className="text-muted-foreground mb-4">
                  Current network: {networkName}
                </p>
                <p className="text-muted-foreground mb-4">
                  Please switch to a supported testnet to start trading
                </p>
                
                {/* Quick Network Switch */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Quick Switch:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Object.values(NETWORKS).map((network) => (
                      <Button
                        key={network.chainId}
                        variant="outline"
                        size="sm"
                        onClick={() => handleNetworkSwitch(network.chainId)}
                        disabled={isSwitchingNetwork}
                        className="text-xs"
                      >
                        {network.name.replace(' Sepolia', '')}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="space-y-3">
  {/* 1inch-style minimalist header */}
  <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <h2 className="text-xl font-semibold">Swap</h2>
        <div className="flex items-center gap-1.5">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
            <Button variant="ghost" size="icon" onClick={fetchBalances} disabled={isLoadingBalances} className="h-8 w-8">
              <RefreshCw className={`w-4 h-4 ${isLoadingBalances ? 'animate-spin' : ''}`} />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} className="h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
  </motion.div>
      <p className="text-xs text-muted-foreground">Simple swaps on one card. Cross-chain supported automatically.</p>

      {/* Environment/RPC health warning */}
      {envWarning && (
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 whitespace-pre-wrap">
          {envWarning}
        </div>
      )}

      {/* Wallet vs. selected source chain notice (auto-switch handles it); keep a subtle indicator while switching */}
      {!isCrossChain && chainId && chainId !== fromChain && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="flex items-center justify-between rounded-md border border-amber-300/40 bg-amber-50 text-amber-900 px-3 py-2 text-xs"
        >
          <div className="truncate">
            {isSwitchingNetwork ? 'Switching network…' : `Wallet on ${prettyChainId(chainId)} · Switching to ${prettyChainId(fromChain)}…`}
          </div>
        </motion.div>
      )}

      {/* Cross-chain Transparency Panel */}
      {isCrossChain && lastTxInfo && lastTxInfo.type==='direct' && (
        <div className="mt-3 p-3 rounded border text-xs bg-muted/30">
          <div className="font-medium mb-1">Cross-chain status</div>
          <div className="grid grid-cols-1 gap-1">
            <div>
              <span className="text-muted-foreground">Wiring:</span>{' '}
              {ccStatus?.wiring ? (
                <span>
                  escrow.router {ccStatus.wiring.escrowRouterOk ? '✅' : '❌'} ·
                  peer(dst) {ccStatus.wiring.routerPeerOk ? '✅' : '❌'} ·
                  router.escrow {ccStatus.wiring.routerEscrowOk === null ? 'n/a' : (ccStatus.wiring.routerEscrowOk ? '✅' : '❌')}
                </span>
              ) : 'checking…'}
            </div>
            <div>
              <span className="text-muted-foreground">Source tx:</span>{' '}
              {ccStatus?.source ? (
                <span>{ccStatus.source.status}{ccStatus.source.blockNumber ? ` @#${ccStatus.source.blockNumber}` : ''}</span>
              ) : 'pending…'}
            </div>
            <div>
              <span className="text-muted-foreground">Delivery:</span>{' '}
              {ccStatus?.delivery?.delivered ? (
                <a className="underline" target="_blank" rel="noreferrer" href={getExplorerUrl(toChain, ccStatus.delivery.txHash!)}>delivered (view)</a>
              ) : 'waiting…'}
            </div>
            {ccStatus?.error && (
              <div className="text-amber-700">{ccStatus.error}</div>
            )}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Network Info */}
              <div>
                <p className="text-sm font-medium mb-2">Network Information</p>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm">{currentChainInfo?.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    Chain ID: {chainId}
                  </Badge>
                </div>
              </div>
              
              {/* Slippage */}
              <div>
                <p className="text-sm font-medium mb-2">Slippage Tolerance</p>
                <div className="flex gap-2">
                  {SLIPPAGE_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      variant={slippage === option ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSlippage(option)}
                    >
                      {option}%
                    </Button>
                  ))}
                </div>
              </div>

              {/* Developer */}
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-2">Developer</p>
                <div className="flex items-center gap-2 text-xs">
                  <Button variant={ccDebug ? 'default' : 'outline'} size="sm" onClick={() => setCcDebug(v => !v)}>
                    {ccDebug ? 'Disable' : 'Enable'} cross-chain debug
                  </Button>
                  <span className="text-muted-foreground">Logs fee bumps and options gas per attempt</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

  {/* Minimal: removed extra network status card for a cleaner look */}

      {/* Swap Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <Card className={`max-w-xl mx-auto shadow-sm transition-all ${isInputActive ? 'ring-1 ring-primary/30' : ''}`}>
          <CardContent className="p-4 space-y-3">
          <div className="space-y-3">
            {/* From Row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">From</span>
                <span className="text-xs text-muted-foreground min-w-[6rem] inline-flex justify-end">
                  {isLoadingBalances ? (
                    <Skeleton className="h-3 w-20 rounded" />
                  ) : (
                    <>Balance: {getSourceBalance(fromToken)}</>
                  )}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                {/* Chain pill */}
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
                  <Select value={fromChain.toString()} onValueChange={(v) => setFromChain(parseInt(v))}>
                    <SelectTrigger className="w-32 h-10">
                      <SelectValue placeholder="Chain" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(NETWORKS).map((n) => (
                        <SelectItem key={n.chainId} value={n.chainId.toString()}>
                          <div className="flex items-center gap-2">
                            <ChainLogo chainId={chainIdToUiKey(n.chainId)} size="sm" />
                            <span>{n.name.replace(' Sepolia', '')}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
                {/* Token selector */}
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
                  <Select value={fromToken} onValueChange={setFromToken}>
                    <SelectTrigger className="w-36 h-10">
                      <SelectValue placeholder="Token" />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedTokens.map((token) => (
                        <SelectItem key={token.address} value={token.address}>
                          <div className="flex items-center gap-2">
                            <TokenLogo size="sm" symbol={token.symbol} />
                            <span>{token.symbol}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
                {/* Amount */}
                <div className="flex-1 relative">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={fromAmount}
                    onFocus={() => setIsInputActive(true)}
                    onBlur={() => setIsInputActive(false)}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="pr-14 h-10 transition-colors"
                  />
                  <Button variant="ghost" size="sm" onClick={setMaxBalance} className="absolute right-1 top-1 h-8 px-2 text-[10px] transition-colors">
                    MAX
                  </Button>
                  {/* Approx USD under input */}
                  {fromAmount && (
                    <div className="absolute -bottom-5 left-0 text-[11px] text-muted-foreground">
                      {(() => {
                        const sym = (getTokenByAddress(fromToken)?.symbol || '').toUpperCase();
                        const amt = Number(fromAmount || '0');
                        const usd = sym === 'USDC' ? amt : (ethUsdPrice ? amt * ethUsdPrice : null);
                        return usd ? `≈ $${usd.toFixed(2)}` : '';
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Swap Arrow */}
            <div className="flex justify-center">
              <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 460, damping: 30 }}>
                <Button variant="outline" size="icon" onClick={swapTokens} className={`rounded-full p-2 h-8 w-8 transition-transform ${swapAnim ? 'pop-once' : ''}`}>
                  <ArrowLeftRight className="w-4 h-4" />
                </Button>
              </motion.div>
            </div>

            {/* To Row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">To</span>
                <span className="text-xs text-muted-foreground min-w-[6rem] inline-flex justify-end">
                  {isCrossChain ? (
                    destBalLoading ? (
                      <Skeleton className="h-3 w-20 rounded" />
                    ) : (
                      <>Balance: {destBalance}</>
                    )
                  ) : (
                    isLoadingBalances ? (
                      <Skeleton className="h-3 w-20 rounded" />
                    ) : (
                      <>Balance: {getSourceBalance(toToken)}</>
                    )
                  )}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                {/* Chain pill */}
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
                  <Select value={toChain.toString()} onValueChange={(v) => setToChain(parseInt(v))}>
                    <SelectTrigger className="w-32 h-10">
                      <SelectValue placeholder="Chain" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(NETWORKS).map((n) => (
                        <SelectItem key={n.chainId} value={n.chainId.toString()}>
                          <div className="flex items-center gap-2">
                            <ChainLogo chainId={chainIdToUiKey(n.chainId)} size="sm" />
                            <span>{n.name.replace(' Sepolia', '')}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
                {/* Token selector */}
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
                  <Select value={toToken} onValueChange={setToToken}>
                    <SelectTrigger className="w-36 h-10">
                      <SelectValue placeholder="Token" />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedTokens.map((token) => (
                        <SelectItem key={token.address} value={token.address}>
                          <div className="flex items-center gap-2">
                            <TokenLogo size="sm" symbol={token.symbol} />
                            <span>{token.symbol}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
                <div className="flex-1 relative h-10">
                  {quoteLoading ? (
                    <div className="absolute inset-0">
                      <Skeleton className="h-full w-full rounded-md" />
                    </div>
                  ) : (
                    <div className="relative">
                      <Input type="number" placeholder="0.00" value={toAmount} readOnly className={`bg-muted h-10 transition-colors w-full`} />
                      {/* Approx USD under output */}
                      {toAmount && (
                        <div className="absolute -bottom-5 left-0 text-[11px] text-muted-foreground">
                          {(() => {
                            const sym = (getTokenByAddress(toToken)?.symbol || '').toUpperCase();
                            const amt = Number(toAmount || '0');
                            const usd = sym === 'USDC' ? amt : (ethUsdPrice ? amt * ethUsdPrice : null);
                            return usd ? `≈ $${usd.toFixed(2)}` : '';
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quote bar (compact) */}
            <AnimatePresence>
            {lastQuote && (
              <motion.div
                className="p-3 bg-muted rounded-lg"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {isCrossChain && (
                      <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
                        <Badge variant="secondary" className="capitalize cursor-default select-none">
                          {lastQuote.routeType === 'multihop' ? `via Ethereum · ${lastQuote.legs?.length ?? 2} legs` : 'direct'}
                        </Badge>
                      </motion.div>
                    )}
                    <span className="text-muted-foreground">ETA</span>
                    <span>{isCrossChain ? '~5–10m' : '<1m'}</span>
                  </div>
                  <motion.button
                    className="text-xs text-primary flex items-center gap-1"
                    onClick={() => setShowDetails(!showDetails)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  >
                    <span className="hover:underline underline-offset-2 decoration-2">Details</span>
                    <motion.span
                      animate={{ rotate: showDetails ? 180 : 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </motion.span>
                  </motion.button>
                </div>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-muted-foreground">Fees</span>
                  <motion.span
                    className={`font-medium ${feePulse ? 'flash-bg rounded px-1' : ''}`}
                    animate={{ scale: feePulse ? 1.02 : 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                  >
                    {(() => {
                      const sym = (getTokenByAddress(fromToken)?.symbol || '').toUpperCase();
                      const d = sym === 'USDC' ? 6 : 18;
                      const totalWei = isCrossChain ? totalDexFeeWeiCrossChain : totalDexFeeWeiSameChain;
                      const totalStr = formatUnits(totalWei, d);
                      const dexFeeNum = Number(totalStr);
                      const lzEth = Number(formatFeeWeiToEth(lastQuote.lzNativeFeeWei || '0'));
                      const dexFeeUsd = sym === 'USDC' ? dexFeeNum : (ethUsdPrice ? dexFeeNum * ethUsdPrice : null);
                      const lzUsd = ethUsdPrice ? lzEth * ethUsdPrice : null;
                      if (isCrossChain) {
                        const lzPart = `${lzEth.toFixed(6)} ETH${lzUsd ? ` (~$${lzUsd.toFixed(2)})` : ''}`;
                        const dexPart = `${dexFeeNum.toFixed(6)} ${sym}${dexFeeUsd ? ` (~$${dexFeeUsd.toFixed(2)})` : ''}`;
                        return `${lzPart} + ${dexPart}`;
                      }
                      return `${dexFeeNum.toFixed(6)} ${sym}${dexFeeUsd ? ` (~$${dexFeeUsd.toFixed(2)})` : ''}`;
                    })()}
                  </motion.span>
                </div>
                {quoteLoading && (
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                )}
                {parseFloat(fromAmount || '0') > 0 && parseFloat(toAmount || '0') > 0 && (
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-muted-foreground">Rate</span>
                    <motion.span
                      className={`${ratePulse ? 'flash-bg' : ''} rounded px-1`}
                      animate={{ scale: ratePulse ? 1.02 : 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                    >
                      1 {getTokenByAddress(fromToken)?.symbol} ≈ {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} {toTokenData?.symbol}
                    </motion.span>
                  </div>
                )}
                <AnimatePresence>
                {showDetails && (
                  <motion.div className="mt-3 space-y-2 text-xs" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center justify-between">
                      <span>Min received</span>
                      <span>{parseFloat(lastQuote.minimumReceived).toFixed(6)} {toTokenData?.symbol}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Price impact</span>
                      <span className={lastQuote.priceImpact > 5 ? 'text-red-500' : 'text-green-500'}>
                        {lastQuote.priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    {ethUsdPrice && (
                      <div className="flex items-center justify-between">
                        <span>Oracle ETH/USD</span>
                        <span>${ethUsdPrice.toFixed(2)}</span>
                      </div>
                    )}
                    {isCrossChain ? (
                      <div className="pt-2 border-t space-y-2">
                        <div className="flex items-center justify-between">
                          <span>Route</span>
                          <span className="capitalize">{lastQuote.routeType}</span>
                        </div>
                        {(() => {
                          const totalNativeWei = lastQuote.routeType === 'multihop'
                            ? (lastQuote.legs || []).reduce((acc, l) => (acc + BigInt(l.nativeFeeWei)), 0n).toString()
                            : (lastQuote.lzNativeFeeWei || '0');
                          const totalNativeEth = parseFloat(formatFeeWeiToEth(totalNativeWei));
                          const usd = ethUsdPrice ? (totalNativeEth * ethUsdPrice) : null;
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <span>Network fee</span>
                                <span>{formatFeeWeiToEth(totalNativeWei)} ETH{usd ? ` (~$${usd.toFixed(2)})` : ''}</span>
                              </div>
                              {(() => {
                                const sym = (getTokenByAddress(fromToken)?.symbol || '').toUpperCase();
                                const d = sym === 'USDC' ? 6 : 18;
                                return (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span>Total DEX fee</span>
                                      <span>
                                        {formatUnits(totalDexFeeWeiCrossChain, d)} {sym} (0.55%)
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span>Breakdown · AMM</span>
                                      <span>{formatUnits(ammFeeWei, d)} {sym} (0.20%)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span>Breakdown · Escrow</span>
                                      <span>{formatUnits(escrowFeeWei, d)} {sym} (0.30%)</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span>Breakdown · Protocol</span>
                                      <span>{formatUnits(protocolFeeWei, d)} {sym} (0.05%)</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </>
                          );
                        })()}
                        {lastQuote.routeType === 'multihop' && lastQuote.legs && (
                          <div className="text-[11px] text-muted-foreground">
                            <button className="underline" onClick={() => setShowLegs(!showLegs)}>
                              {showLegs ? 'Hide legs' : `View legs (${lastQuote.legs.length})`}
                            </button>
                            <AnimatePresence>
                              {showLegs && (
                                <motion.div className="mt-1 space-y-1" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
                  {lastQuote.legs.map((leg, idx) => (
                                    <motion.div
                                      key={idx}
                                      initial={{ opacity: 0, y: 4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: 4 }}
                                      transition={{ duration: 0.16, delay: idx * 0.03 }}
                                    >
                    {prettyChainKey(leg.from)} → {prettyChainKey(leg.to)}: {formatFeeWeiToEth(leg.nativeFeeWei)} ETH{leg.lzTokenFeeWei ? ` + ${formatFeeWeiToEth(leg.lzTokenFeeWei)} LZ` : ''}
                                    </motion.div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                        {/* Explorer links for last send, if available and matching the current route */}
                        {lastTxInfo && (
                          <div className="pt-2 border-t space-y-1 text-[11px]">
                            <div className="font-medium text-xs">Transactions</div>
                            {lastTxInfo.type === 'direct' && lastTxInfo.fromChainId === fromChain && lastTxInfo.toChainId === toChain && (
                              <div className="flex items-center justify-between">
                                <span>{prettyChainId(lastTxInfo.fromChainId)}</span>
                                <motion.a
                                  className="underline"
                                  href={getExplorerUrl(lastTxInfo.fromChainId, lastTxInfo.txHash)}
                                  target="_blank"
                                  rel="noreferrer"
                                  whileHover={{ x: 0.5 }}
                                  whileTap={{ scale: 0.98 }}
                                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                                  style={{ textDecorationThickness: 2, textUnderlineOffset: 3 }}
                                >
                                  View tx
                                </motion.a>
                              </div>
                            )}
                            {lastTxInfo.type === 'multihop' && lastTxInfo.fromChainId === fromChain && lastTxInfo.toChainId === toChain && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span>{prettyChainId(lastTxInfo.fromChainId)} → Ethereum</span>
                                  <motion.a
                                    className="underline"
                                    href={getExplorerUrl(lastTxInfo.fromChainId, lastTxInfo.leg1)}
                                    target="_blank"
                                    rel="noreferrer"
                                    whileHover={{ x: 0.5 }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                                    style={{ textDecorationThickness: 2, textUnderlineOffset: 3 }}
                                  >
                                    View leg 1
                                  </motion.a>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Ethereum → {prettyChainId(lastTxInfo.toChainId)}</span>
                                  <motion.a
                                    className="underline"
                                    href={getExplorerUrl(lastTxInfo.hopChainId, lastTxInfo.leg2)}
                                    target="_blank"
                                    rel="noreferrer"
                                    whileHover={{ x: 0.5 }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                                    style={{ textDecorationThickness: 2, textUnderlineOffset: 3 }}
                                  >
                                    View leg 2
                                  </motion.a>
                                </div>
                              </div>
                            )}
                            {/* Cancel pending (refund) */}
                            <div className="pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    toast.loading('Cancelling order…', { id: 'cc-cancel' })
                                    const fromUi = chainIdToUiKey(fromChain)
                                    const txh = await cancelOrder({ fromUiKey: fromUi, orderId: BigInt(lastTxInfo.orderId) })
                                    toast.success(`Cancel tx: ${txh.slice(0,10)}…`, { id: 'cc-cancel' })
                                  } catch (e: unknown) {
                                    const msg = (e as Error)?.message || 'Cancel failed'
                                    toast.error(msg, { id: 'cc-cancel' })
                                  }
                                }}
                              >
                                Cancel pending (refund)
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t space-y-2">
                        {(() => {
                          const sym = (getTokenByAddress(fromToken)?.symbol || '').toUpperCase();
                          const d = sym === 'USDC' ? 6 : 18;
                          const totalStr = formatUnits(totalDexFeeWeiSameChain, d);
                          const totalNum = Number(totalStr);
                          const usd = sym === 'USDC' ? totalNum : (ethUsdPrice ? totalNum * ethUsdPrice : null);
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <span>Total DEX fee</span>
                                <span>
                                  {totalNum.toFixed(6)} {sym} (0.25%){usd ? ` (~$${usd.toFixed(2)})` : ''}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Breakdown · AMM</span>
                                <span>
                                  {(() => { const v = Number(formatUnits(ammFeeWei, d)); const u = sym==='USDC'?v:(ethUsdPrice? v*ethUsdPrice:null); return `${v.toFixed(6)} ${sym} (0.20%)${u?` (~$${u.toFixed(2)})`:''}`; })()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Breakdown · Protocol</span>
                                <span>
                                  {(() => { const v = Number(formatUnits(protocolFeeWei, d)); const u = sym==='USDC'?v:(ethUsdPrice? v*ethUsdPrice:null); return `${v.toFixed(6)} ${sym} (0.05%)${u?` (~$${u.toFixed(2)})`:''}`; })()}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </motion.div>
                )}
                </AnimatePresence>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Swap Button (with subtle spring animation) */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              <Button
                onClick={handleSwap}
                disabled={!lastQuote || isSwapping || !fromAmount || (!isCrossChain && (isSwitchingNetwork || !walletOnFromChain)) || (isCrossChain && !routeOk)}
                className="w-full h-11"
                size="default"
              >
                {isSwapping ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {isCrossChain ? 'Processing Cross-Chain...' : 'Swapping...'}
                  </>
                ) : quoteLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Getting Quote...
                  </>
                ) : (!isCrossChain && !walletOnFromChain) ? (
                  isSwitchingNetwork ? 'Switching Network…' : `Switching to ${prettyChainId(fromChain)}…`
                ) : (isCrossChain && !routeOk) ? (
                  'Route not available'
                ) : !fromAmount ? (
                  'Enter Amount'
                ) : !lastQuote ? (
                  'No Quote Available'
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {isCrossChain ? 'Swap Cross-Chain' : 'Swap'}
                  </>
                )}
              </Button>
            </motion.div>
          </div>
          {/* Route unsupported notice */}
          {isCrossChain && !routeOk && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Cross-chain route not configured for {prettyChainId(fromChain)} → {prettyChainId(toChain)}.
              {!!routeReason && <span className="ml-1 text-amber-600">({routeReason})</span>}
            </div>
          )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
