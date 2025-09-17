import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { toast } from '../utils/lazyToast';
import { TrendingUp, TrendingDown, Target, Clock, Activity, RefreshCw, ChevronDown, ChevronUp, ArrowRightLeft, Network } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useIsMobile } from './ui/use-mobile';
import { CONTRACTS } from '../services/contracts';
import { ChainLogo } from './ui/chain-logo';
import { Price, Text } from './ui/text';
import { ethers } from 'ethers';

// Interfaces
interface CrossChainQuote {
  success?: boolean;
  nativeFee: string;
  estimatedTime?: number;
}

interface MockPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  pnl: string;
  timestamp: number;
}

// Networks optimized for futures trading
const FUTURES_NETWORKS = {
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    logo: '🔵',
    maxLeverage: 100,
    avgGasFee: '$0.25',
    pairs: [
      { symbol: 'BTCUSDT', markPrice: '43523.75', fundingRate: '0.0095' },
      { symbol: 'ETHUSDT', markPrice: '2567.89', fundingRate: '0.0123' },
      { symbol: 'ARBUSDT', markPrice: '1.2345', fundingRate: '0.0089' },
    ]
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    logo: '⬢',
    maxLeverage: 125,
    avgGasFee: '$0.20',
    pairs: [
      { symbol: 'BTCUSDT', markPrice: '43525.12', fundingRate: '0.0102' },
      { symbol: 'ETHUSDT', markPrice: '2569.45', fundingRate: '0.0089' },
      { symbol: 'BNBUSDT', markPrice: '315.42', fundingRate: '0.0076' },
    ]
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    logo: '⬟',
    maxLeverage: 50,
    avgGasFee: '$0.01',
    pairs: [
      { symbol: 'BTCUSDT', markPrice: '43519.45', fundingRate: '0.0087' },
      { symbol: 'ETHUSDT', markPrice: '2566.34', fundingRate: '0.0145' },
      { symbol: 'MATICUSDT', markPrice: '0.8523', fundingRate: '0.0067' },
    ]
  }
};

export function PerpetualFutures() {
  const { isConnected, provider, signer } = useWallet();
  const isMobile = useIsMobile();
  const [selectedNetwork, setSelectedNetwork] = useState('arbitrum');
  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [leverage, setLeverage] = useState([10]);
  const [position, setPosition] = useState<'long' | 'short' | null>(null);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [marginMode, setMarginMode] = useState<'isolated' | 'cross'>('isolated');
  const [positionSizeUSDT, setPositionSizeUSDT] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(43523.75);
  const [fundingCountdown, setFundingCountdown] = useState(4.5);
  const [isOrderBookExpanded, setIsOrderBookExpanded] = useState(false);
  
  // Cross-chain state variables
  const [crossChainEnabled, setCrossChainEnabled] = useState(false);
  const [targetChain, setTargetChain] = useState('arbitrum'); // Default to Arbitrum as target
  const [crossChainQuote, setCrossChainQuote] = useState<CrossChainQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  
  // Real balance fetching
  const [realUsdcBalance, setRealUsdcBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // Mock positions state for now - TODO: Replace with real positions from backend
  const [mockPositions, setMockPositions] = useState<MockPosition[]>([]);
  
  const currentNetwork = FUTURES_NETWORKS[selectedNetwork as keyof typeof FUTURES_NETWORKS];
  const currentPairData = currentNetwork?.pairs.find(pair => pair.symbol === selectedPair);

  // Debug MetaMask connection - simple test
  const testMetaMaskConnection = async () => {
    try {
      if (!isConnected) {
        toast.error('Wallet not connected. Please connect first.');
        return;
      }

      if (!provider || !signer) {
        toast.error('Provider or signer not available');
        return;
      }

      console.log('🔍 Testing wallet connection...');
      
      // Get network
      const network = await provider.getNetwork();
      console.log('✅ Network:', {
        name: network.name,
        chainId: Number(network.chainId)
      });
      
      // Get signer address
      const address = await signer.getAddress();
      console.log('✅ Signer address:', address);
      
      toast.success(`Connected to ${network.name} (${Number(network.chainId)})`);
      
    } catch (error: unknown) {
      console.error('❌ Wallet connection test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Connection test failed: ${errorMessage}`);
    }
  };

  // Initialize CrossChain provider when needed
  const initializeCrossChainProvider = async () => {
    if (!isConnected) {
      throw new Error('Wallet not connected. Please connect your wallet first.');
    }

    if (!provider || !signer) {
      throw new Error('Provider or signer not available');
    }

    try {
      // Provider initialized for futures trading
      return { provider, signer };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize futures trading: ${errorMessage}`);
    }
  };

  // Get available balance from real wallet balances
  const getAvailableBalance = (): number => {
    // Use real fetched balance if available
    if (realUsdcBalance > 0) {
      return realUsdcBalance;
    }

    if (!isConnected) {
      return 0;
    }
    
    // For now, return a mock balance since we're not using the old DEX context
    // TODO: Implement real balance fetching using the new wallet service
    return 1000; // Mock USDC balance for testing
  };

  const availableBalance = getAvailableBalance();

  // Update current price based on selected pair
  useEffect(() => {
    if (currentPairData) {
      setCurrentPrice(parseFloat(currentPairData.markPrice));
      if (orderType === 'limit' && !limitPrice) {
        setLimitPrice(currentPairData.markPrice);
      }
    }
  }, [currentPairData, orderType, limitPrice]);

  // Simulate real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        const change = (Math.random() - 0.5) * 20;
        return Math.max(prev + change, prev * 0.9);
      });
      
      setFundingCountdown(prev => {
        const newTime = prev - (1/3600);
        return newTime <= 0 ? 8 : newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Simple orderbook data
  const orderBookData = Array.from({ length: 8 }, (_, i) => ({
    price: i < 4 
      ? (currentPrice - (4 - i) * 0.5).toFixed(2)  // Bids (buy orders)
      : (currentPrice + (i - 3) * 0.5).toFixed(2), // Asks (sell orders)
    size: (Math.random() * 5 + 0.1).toFixed(3),
    side: i < 4 ? 'bid' : 'ask'
  }));

  const calculateLiquidationPrice = () => {
    if (!position) return 'N/A';
    const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice || '0');
    const lev = leverage[0];
    
    if (position === 'long') {
      return (price * (1 - 0.9 / lev)).toFixed(2);
    } else {
      return (price * (1 + 0.9 / lev)).toFixed(2);
    }
  };

  // Debug cross-chain data format
  const debugCrossChainData = () => {
    if (!position || !positionSizeUSDT) {
      toast.error('Please configure position first');
      return;
    }

    const chainNameToId = {
      'ethereum': 11155111,
      'arbitrum': 421614,
      'optimism': 11155420,
      'base': 84532,
      'polygon': 80002
    };
    
    const sourceChainId = chainNameToId[selectedNetwork as keyof typeof chainNameToId] || 11155111;
    const targetChainId = chainNameToId[targetChain as keyof typeof chainNameToId] || 11155111;

    console.log('🔍 Cross-Chain Debug Data:');
    console.log('📊 Raw Values:', {
      position,
      positionSizeUSDT,
      orderType,
      currentPrice,
      limitPrice,
      leverage: leverage[0],
      selectedNetwork,
      targetChain
    });

    console.log('🔗 Chain Mapping:', {
      sourceNetwork: selectedNetwork,
      targetNetwork: targetChain,
      sourceChainId
    });

    const sourceContracts = CONTRACTS[sourceChainId as keyof typeof CONTRACTS];
    console.log('📜 Source Contracts:', sourceContracts);

    if (!sourceContracts) {
      toast.error(`No contracts found for chain ${sourceChainId}`);
      return;
    }

    // Test data conversion
    try {
      // Use parseEther/parseUnits for proper conversion
      const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice);
      const positionSize = parseFloat(positionSizeUSDT);
      const lev = leverage[0];
      const margin = positionSize / lev;

      // Convert to wei using proper ethers functions
      const priceInWei = (price * 1e18).toString(); // Price in wei (18 decimals)
      const amountInWei = (positionSize * 1e18).toString(); // Amount in wei
      const marginInWei = (margin * 1e18).toString(); // Margin in wei

      const orderData = {
        baseToken: sourceContracts.testETH,
        quoteToken: sourceContracts.testUSDC,
        price: priceInWei,
        amount: amountInWei,
        leverage: lev,
        margin: marginInWei,
        side: (position === 'long' ? 'long' : 'short') as 'long' | 'short',
        fromChain: sourceChainId,
        toChain: targetChainId
      };

      console.log('💰 Converted Order Data:', {
        originalValues: {
          price,
          positionSize,
          leverage: lev,
          margin
        },
        convertedValues: {
          priceInWei,
          amountInWei,
          leverageValue: lev,
          marginInWei
        },
        orderData
      });
      toast.success('Data format looks good! Check console for details.');

    } catch (error: unknown) {
      console.error('❌ Data conversion failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Data conversion failed: ${errorMessage}`);
    }
  };

  // Cross-chain quote function
  const handleGetCrossChainQuote = async () => {
    if (!position || !positionSizeUSDT) {
      toast.error('Please configure position first');
      return;
    }

    setIsQuoting(true);
    try {
      // Initialize provider first
      await initializeCrossChainProvider();

      // Get chain IDs from target chain name
      const chainNameToId = {
        'ethereum': 11155111,
        'arbitrum': 421614,
        'optimism': 11155420,
        'base': 84532,
        'polygon': 80002
      };
      
      const sourceChainId = chainNameToId[selectedNetwork as keyof typeof chainNameToId] || 11155111;

      // Get contract addresses for the source chain
      const sourceContracts = CONTRACTS[sourceChainId as keyof typeof CONTRACTS];
      if (!sourceContracts) {
        throw new Error(`Unsupported source chain: ${selectedNetwork}`);
      }

      // Get quote for futures trading
      const quote = { nativeFee: '0', estimatedTime: 0 };
      setCrossChainQuote(quote);
      
      toast.success(`Futures order prepared successfully`);
      
    } catch (error) {
      console.error('Quote failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get cross-chain quote';
      toast.error(errorMessage);
    } finally {
      setIsQuoting(false);
    }
  };

  const handleOpenPosition = async () => {
    if (!position) {
      toast.error('Please select Long or Short position');
      return;
    }
    if (!positionSizeUSDT) {
      toast.error('Please enter position size');
      return;
    }
    
    const positionMargin = parseFloat(positionSizeUSDT);
    if (positionMargin > availableBalance) {
      toast.error(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`);
      return;
    }

    setIsLoading(true);
    
    try {
      // Check if cross-chain is enabled
      if (crossChainEnabled && targetChain !== selectedNetwork) {
        // Cross-chain order
        toast.loading(`Sending cross-chain ${position?.toUpperCase()} order...`, { id: 'open-position' });
        
        // Initialize provider first
        await initializeCrossChainProvider();

        // Get chain IDs from target chain name
        const chainNameToId = {
          'ethereum': 11155111,
          'arbitrum': 421614,
          'optimism': 11155420,
          'base': 84532,
          'polygon': 80002
        };
        
        const sourceChainId = chainNameToId[selectedNetwork as keyof typeof chainNameToId] || 11155111;

        // Get contract addresses for the source chain
        const sourceContracts = CONTRACTS[sourceChainId as keyof typeof CONTRACTS];
        if (!sourceContracts) {
          throw new Error(`Unsupported source chain: ${selectedNetwork}`);
        }

        // Send futures order
        const txHash = '0x' + Math.random().toString(16).substr(2, 64); // Mock transaction hash
        
        toast.success(`${position?.toUpperCase()} position opened successfully!`, { 
          id: 'open-position',
          description: `Transaction: ${txHash.substring(0, 8)}...`
        });
      } else {
        // Regular order - for now just show success toast as this is mock functionality
        toast.loading(`Opening ${position?.toUpperCase()} position...`, { id: 'open-position' });
        
        // TODO: Implement real position opening with backend contracts
        await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
        
        toast.success(`${position?.toUpperCase()} position opened successfully!`, { id: 'open-position' });
      }
      
      // Balance will update automatically when the action refreshes balances
      setPosition(null);
      setPositionSizeUSDT('');
      setLimitPrice('');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(errorMessage || 'Failed to open position', { id: 'open-position' });
    } finally {
      setIsLoading(false);
    }
  };

  // Real balance fetching function
  const fetchRealBalance = useCallback(async () => {
    if (!isConnected || !provider) {
      toast.error('Wallet not connected');
      return;
    }

    setIsLoadingBalance(true);
    try {
      // Use the wallet service provider and signer
      if (!signer) {
        throw new Error('Signer not available');
      }
      
      const userAddress = await signer.getAddress();
      
      // Get current network
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      console.log('🔍 Fetching balance for:', { userAddress, chainId, network: network.name });

      // Get contract addresses for current chain
      const contracts = CONTRACTS[chainId as keyof typeof CONTRACTS];
      if (!contracts) {
        toast.error(`Unsupported network: ${network.name}`);
        return;
      }

      // Get ETH balance
      const ethBalance = await provider.getBalance(userAddress);
      const ethBalanceFormatted = parseFloat(ethers.formatEther(ethBalance));

      // Get USDC balance (ERC20)
      const usdcContract = new ethers.Contract(
        contracts.testUSDC,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        provider
      );
      
      const usdcBalance = await usdcContract.balanceOf(userAddress);
      const usdcDecimals = await usdcContract.decimals();
      const usdcBalanceFormatted = parseFloat(ethers.formatUnits(usdcBalance, usdcDecimals));

      // Update real USDC balance
      setRealUsdcBalance(usdcBalanceFormatted);
      
      console.log('💰 Real balances fetched:', {
        ETH: ethBalanceFormatted,
        USDC: usdcBalanceFormatted
      });
      toast.success(`Balance updated: ${usdcBalanceFormatted.toFixed(2)} USDC`);

    } catch (error: unknown) {
      console.error('❌ Balance fetch error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to fetch balance: ${errorMessage}`);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [isConnected, provider, signer, setIsLoadingBalance, setRealUsdcBalance]);

  // Fetch real balance on network or account change
  useEffect(() => {
    if (isConnected) {
      fetchRealBalance();
    }
  }, [isConnected, selectedNetwork, fetchRealBalance]);

  // For now, comment out the balance update from context since we're not using it
  // TODO: Implement real balance tracking with new wallet service
  // useEffect(() => {
  //   const usdBalance = state.userBalances.find(b => 
  //     b.asset.includes('USDC') || b.asset.includes('USDT')
  //   );
  //   
  //   if (usdBalance) {
  //     setRealUsdcBalance(parseFloat(usdBalance.available));
  //   }
  // }, [state.userBalances]);

  // Format time helper
  const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-2' : ''}`}>
        <div className="flex items-center gap-3">
          {/* Cross-Chain Badge */}
          <Badge variant="outline" className="bg-dex-primary/10 text-dex-primary border-dex-primary/20">
            <Network className="w-3 h-3 mr-1" />
            Cross-Chain Futures
          </Badge>
          
          {/* Network Selector */}
          <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
            <SelectTrigger className="w-auto h-10 bg-muted border-0">
              <div className="flex items-center gap-2">
                <ChainLogo chainId={currentNetwork.id} size="sm" />
                <span className="font-medium">{isMobile ? currentNetwork.name.split(' ')[0] : currentNetwork.name}</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {Object.values(FUTURES_NETWORKS).map((network) => (
                <SelectItem key={network.id} value={network.id}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <ChainLogo chainId={network.id} size="sm" />
                      <span>{network.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs ml-2">
                      {network.maxLeverage}x
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Pair Selector */}
          <Select value={selectedPair} onValueChange={setSelectedPair}>
            <SelectTrigger className="w-auto h-10 bg-muted border-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedPair}</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {currentNetwork?.pairs.map((pair) => (
                <SelectItem key={pair.symbol} value={pair.symbol}>
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{pair.symbol}</span>
                    <span className="text-xs text-muted-foreground ml-2">${pair.markPrice}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-right">
          <Price value={currentPrice} size="lg" />
          <Text variant="caption" color="secondary">
            Mark Price
          </Text>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Wide Chart */}
        <Card>
          <CardContent className="p-4">
            <div className="h-64 lg:h-80 bg-accent/10 rounded-lg flex items-center justify-center relative">
              <div className="text-center">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <div className="text-lg font-medium">Futures Chart</div>
                <div className="text-sm mt-1 text-muted-foreground">{selectedPair} on {currentNetwork.name}</div>
              </div>
              
              <div className="absolute top-3 left-3 flex items-center gap-3">
                <Badge variant="outline" className="bg-card">
                  <span className="mr-1">{currentNetwork.logo}</span>
                  {currentNetwork.name.split(' ')[0]}
                </Badge>
                <Badge variant="outline" className="text-orange-600 bg-card">
                  Funding: {currentPairData?.fundingRate}%
                </Badge>
                <Badge variant="outline" className="bg-card">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(fundingCountdown)}
                </Badge>
              </div>
              
              <div className="absolute top-3 right-3 bg-card border rounded px-3 py-2">
                <div className="text-lg font-bold">${currentPrice.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground text-center">Mark Price</div>
              </div>
              
              {/* Live price indicator */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-dex-success rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">Live Price Feed</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Book and Trading Panel Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Order Book */}
          <Card>
            <CardContent className="p-4">
              <div 
                className={`flex items-center justify-between mb-3 ${isMobile ? 'cursor-pointer' : ''}`}
                onClick={isMobile ? () => setIsOrderBookExpanded(!isOrderBookExpanded) : undefined}
              >
                <h3 className="text-sm font-medium">Order Book</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Activity className="w-3 h-3 mr-1" />
                    Live
                  </Badge>
                  {isMobile && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      {isOrderBookExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              {(!isMobile || isOrderBookExpanded) && (
                <div className="space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground border-b pb-2">
                    <div>Price (USDT)</div>
                    <div className="text-right">Size</div>
                  </div>
                  
                  {/* Asks (Sell orders) */}
                  {orderBookData.filter(item => item.side === 'ask').reverse().slice(0, 5).map((item, index) => (
                    <div key={`ask-${index}`} className="grid grid-cols-2 gap-4 text-xs py-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer rounded">
                      <div className="text-dex-danger font-mono">{item.price}</div>
                      <div className="text-right font-mono">{item.size}</div>
                    </div>
                  ))}
                  
                  {/* Current Price */}
                  <div className="text-center py-3 border-y bg-accent/20 my-2">
                    <div className="text-base font-bold">${currentPrice.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">Mark Price</div>
                  </div>
                  
                  {/* Bids (Buy orders) */}
                  {orderBookData.filter(item => item.side === 'bid').slice(0, 5).map((item, index) => (
                    <div key={`bid-${index}`} className="grid grid-cols-2 gap-4 text-xs py-1.5 hover:bg-green-50 dark:hover:bg-green-950/20 cursor-pointer rounded">
                      <div className="text-dex-success font-mono">{item.price}</div>
                      <div className="text-right font-mono">{item.size}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trading Panel */}
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Long/Short Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setPosition('long')}
                  className={`h-10 ${
                    position === 'long'
                      ? 'bg-dex-success hover:bg-dex-success/90 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Long
                </Button>
                <Button
                  onClick={() => setPosition('short')}
                  className={`h-10 ${
                    position === 'short'
                      ? 'bg-dex-danger hover:bg-dex-danger/90 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <TrendingDown className="w-4 h-4 mr-1" />
                  Short
                </Button>
              </div>

              {/* Order Type */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={orderType === 'market' ? 'default' : 'outline'}
                  onClick={() => setOrderType('market')}
                  size="sm"
                >
                  Market
                </Button>
                <Button
                  variant={orderType === 'limit' ? 'default' : 'outline'}
                  onClick={() => setOrderType('limit')}
                  size="sm"
                >
                  Limit
                </Button>
              </div>

              {/* Limit Price */}
              {orderType === 'limit' && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Limit Price</div>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="bg-muted border-0"
                  />
                </div>
              )}

              {/* Leverage */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Leverage</span>
                  <span className="text-sm text-muted-foreground">{leverage[0]}x</span>
                </div>
                <Slider
                  value={leverage}
                  onValueChange={setLeverage}
                  max={currentNetwork.maxLeverage}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1x</span>
                  <span>{currentNetwork.maxLeverage}x</span>
                </div>
              </div>

              {/* Position Size and Account Info */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Margin (USDT)</span>
                    <div className="text-xs text-muted-foreground">
                      Available: ${availableBalance.toFixed(2)}
                    </div>
                  </div>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={positionSizeUSDT}
                    onChange={(e) => setPositionSizeUSDT(e.target.value)}
                    className="bg-muted border-0"
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Margin Mode</span>
                  <Select value={marginMode} onValueChange={(value: 'isolated' | 'cross') => setMarginMode(value)}>
                    <SelectTrigger className="w-24 h-8 bg-muted border-0 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="isolated">Isolated</SelectItem>
                      <SelectItem value="cross">Cross</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cross-Chain Settings */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Cross-Chain Trading</span>
                  </div>
                  <Switch
                    checked={crossChainEnabled}
                    onCheckedChange={setCrossChainEnabled}
                  />
                </div>
                
                {crossChainEnabled && (
                  <div className="space-y-3 pl-6">
                    {/* Wallet Connection Status */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Wallet</span>
                      <div className="flex items-center gap-2">
                        {window.ethereum ? (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                            MetaMask Ready
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                            Install MetaMask
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Debug Button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={testMetaMaskConnection}
                      className="w-full"
                    >
                      🔍 Test MetaMask Connection
                    </Button>
                    
                    {/* Fetch Real Balance Button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchRealBalance}
                      disabled={isLoadingBalance}
                      className="w-full"
                    >
                      {isLoadingBalance ? '🔄 Loading...' : '💰 Fetch Real Balance'}
                    </Button>
                    
                    {/* Data Debug Button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={debugCrossChainData}
                      className="w-full"
                    >
                      📊 Debug Cross-Chain Data
                    </Button>
                    
                    {/* Real Balance Display */}
                    {realUsdcBalance > 0 && (
                      <div className="text-sm p-3 bg-green-500/10 border border-green-500/20 rounded">
                        <div className="text-green-400 font-medium">Real Balance: {realUsdcBalance.toFixed(4)} USDC</div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Target Chain</div>
                      <Select value={targetChain} onValueChange={setTargetChain}>
                        <SelectTrigger className="bg-muted border-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FUTURES_NETWORKS).map(([chainId, chain]) => (
                            <SelectItem 
                              key={chainId} 
                              value={chainId}
                              disabled={chainId === selectedNetwork}
                            >
                              <div className="flex items-center gap-2">
                                <span>{chain.name}</span>
                                {chainId === selectedNetwork && (
                                  <Badge variant="secondary" className="text-xs">Current</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {targetChain !== selectedNetwork && (
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGetCrossChainQuote}
                          disabled={isQuoting || !position || !positionSizeUSDT}
                          className="w-full"
                        >
                          {isQuoting ? (
                            <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="w-3 h-3 mr-2" />
                          )}
                          Get Cross-Chain Quote
                        </Button>
                        
                        {crossChainQuote && (
                          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Cross-Chain Fee</span>
                              <span className="font-mono">
                                {crossChainQuote.success 
                                  ? `${(parseFloat(crossChainQuote.nativeFee) / 1e18).toFixed(6)} ETH`
                                  : 'Failed'
                                }
                              </span>
                            </div>
                            {crossChainQuote.success && (
                              <div className="flex justify-between mt-1">
                                <span className="text-muted-foreground">Est. Time</span>
                                <span>~30 seconds</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Position Details */}
              {positionSizeUSDT && position && (
                <div className="bg-accent/20 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Position Size</span>
                    <span>${(parseFloat(positionSizeUSDT) * leverage[0]).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Liq. Price</span>
                    <span>${calculateLiquidationPrice()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Fee</span>
                    <span>${(parseFloat(positionSizeUSDT) * 0.001).toFixed(4)}</span>
                  </div>
                  {crossChainEnabled && targetChain !== selectedNetwork && crossChainQuote?.success && (
                    <div className="flex justify-between text-blue-600 dark:text-blue-400">
                      <span className="text-muted-foreground">+ Cross-Chain Fee</span>
                      <span>${(parseFloat(crossChainQuote.nativeFee) / 1e18 * 2000).toFixed(4)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Open Position Button */}
              <Button
                onClick={handleOpenPosition}
                disabled={isLoading || !position || !positionSizeUSDT}
                className={`h-12 w-full font-semibold ${
                  position === 'long'
                    ? 'bg-dex-success hover:bg-dex-success/90'
                    : position === 'short'
                    ? 'bg-dex-danger hover:bg-dex-danger/90'
                    : 'bg-muted'
                } text-white`}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <>
                    {position === 'long' ? (
                      <TrendingUp className="w-4 h-4 mr-2" />
                    ) : position === 'short' ? (
                      <TrendingDown className="w-4 h-4 mr-2" />
                    ) : (
                      <Target className="w-4 h-4 mr-2" />
                    )}
                    {!position ? 'Select Position' : `Open ${position.toUpperCase()}`}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live Open Positions - Scrollable Section */}
        {mockPositions.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Live Open Positions</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="animate-pulse">
                    <Activity className="w-3 h-3 mr-1" />
                    Real-time P&L
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {mockPositions.length} Active
                  </Badge>
                  {mockPositions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMockPositions([]);
                        toast.success('All positions closed');
                      }}
                      className="text-xs h-6 px-2 text-dex-danger border-dex-danger hover:bg-dex-danger hover:text-white"
                    >
                      Close All
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Fixed height scrollable container */}
              <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                {mockPositions.map((pos) => {
                  // TODO: Implement real position calculations with backend contracts
                  const realTimePnL = "0.00"; // Mock value
                  
                  return (
                    <div key={pos.id} className="p-4 border rounded-lg">
                      <p>Position: {pos.symbol} - Mock position component</p>
                      <p>PnL: ${realTimePnL} (0.00%)</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setMockPositions(prev => prev.filter(p => p.id !== pos.id));
                          toast.success('Position closed');
                        }}
                      >
                        Close Position
                      </Button>
                    </div>
                  );
                })}
              </div>
              
              {/* Scroll indicator for many positions */}
              {mockPositions.length > 3 && (
                <div className="text-center mt-2 text-xs text-muted-foreground">
                  Scroll to view all {mockPositions.length} positions
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}