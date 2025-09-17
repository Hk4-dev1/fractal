import React, { createContext, useContext, useReducer, useEffect, ReactNode, useMemo } from 'react';
import { dexApi, TradingPair, Order, Position, UserBalance } from '../services/api';
import { dexWebSocket, WebSocketMessage } from '../services/websocket';
import { dexStorage } from '../utils/storage';
import { toast } from '../utils/lazyToast';
// Import
import { walletService } from '../services/wallet';

// Additional interfaces
interface OrderBookEntry {
  price: string;
  amount: string;
}

interface RecentTrade {
  price: string;
  amount: string;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface SpotPosition {
  id: string;
  symbol: string;
  size: string;
  entryPrice: string;
  currentPrice?: string;
  pnl: string;
  timestamp: number;
  type: string;
}

interface OrderData {
  symbol: string;
  side: 'buy' | 'sell';
  type?: 'market' | 'limit';
  amount: string;
  price: string;
}

interface PositionData {
  symbol: string;
  side: 'long' | 'short';
  amount: string;
  price: string;
  leverage: number;
  network?: string;
}

interface SwapData {
  fromToken: string;
  toToken: string;
  amount: string;
  fromChain: number;
  toChain: number;
  token?: string; // For backward compatibility
  sourceChain?: string;
  destChain?: string;
}

// State interface
interface DEXState {
  // Market data
  tradingPairs: TradingPair[];
  currentPair: TradingPair | null;
  orderBook: { bids: OrderBookEntry[]; asks: OrderBookEntry[] };
  recentTrades: RecentTrade[];
  
  // User data
  userBalances: UserBalance[];
  userOrders: Order[];
  userPositions: Position[];
  spotPositions: SpotPosition[];
  spotOrders: Order[];
  
  // Connection status
  isConnected: boolean;
  isLoading: boolean;
  
  // Settings
  selectedWallet: string | null;
  darkMode: boolean;
  language: string;
}

// Action types
type DEXAction = 
  | { type: 'SET_TRADING_PAIRS'; payload: TradingPair[] }
  | { type: 'SET_CURRENT_PAIR'; payload: TradingPair }
  | { type: 'UPDATE_PRICE'; payload: { symbol: string; price: string; change: string } }
  | { type: 'SET_ORDER_BOOK'; payload: { bids: OrderBookEntry[]; asks: OrderBookEntry[] } }
  | { type: 'ADD_RECENT_TRADE'; payload: RecentTrade }
  | { type: 'SET_USER_BALANCES'; payload: UserBalance[] }
  | { type: 'ADD_USER_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER_STATUS'; payload: { orderId: string; status: string } }
  | { type: 'ADD_USER_POSITION'; payload: Position }
  | { type: 'REMOVE_USER_POSITION'; payload: string }
  | { type: 'ADD_SPOT_POSITION'; payload: SpotPosition }
  | { type: 'REMOVE_SPOT_POSITION'; payload: string }
  | { type: 'SET_SPOT_ORDERS'; payload: Order[] }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SELECTED_WALLET'; payload: string | null }
  | { type: 'SET_DARK_MODE'; payload: boolean }
  | { type: 'SET_LANGUAGE'; payload: string };

// Initial state
const initialState: DEXState = {
  tradingPairs: [],
  currentPair: null,
  orderBook: { bids: [], asks: [] },
  recentTrades: [],
  userBalances: [],
  userOrders: [],
  userPositions: [],
  spotPositions: [],
  spotOrders: [],
  isConnected: false,
  isLoading: false,
  selectedWallet: null,
  darkMode: false,
  language: 'en',
};

// Reducer
function dexReducer(state: DEXState, action: DEXAction): DEXState {
  switch (action.type) {
    case 'SET_TRADING_PAIRS':
      return { ...state, tradingPairs: action.payload };
    
    case 'SET_CURRENT_PAIR':
      return { ...state, currentPair: action.payload };
    
    case 'UPDATE_PRICE':
      return {
        ...state,
        tradingPairs: state.tradingPairs.map(pair => 
          pair.symbol === action.payload.symbol 
            ? { ...pair, price: action.payload.price, change24h: action.payload.change }
            : pair
        ),
        currentPair: state.currentPair?.symbol === action.payload.symbol
          ? { ...state.currentPair, price: action.payload.price, change24h: action.payload.change }
          : state.currentPair
      };
    
    case 'SET_ORDER_BOOK':
      return { ...state, orderBook: action.payload };
    
    case 'ADD_RECENT_TRADE':
      return {
        ...state,
        recentTrades: [action.payload, ...state.recentTrades.slice(0, 49)] // Keep last 50 trades
      };
    
    case 'SET_USER_BALANCES':
      return { ...state, userBalances: action.payload };
    
    case 'ADD_USER_ORDER':
      return { ...state, userOrders: [action.payload, ...state.userOrders] };
    
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        userOrders: state.userOrders.map(order =>
          order.id === action.payload.orderId
            ? { ...order, status: action.payload.status as Order['status'] }
            : order
        )
      };
    
    case 'ADD_USER_POSITION':
      return { ...state, userPositions: [action.payload, ...state.userPositions] };
    
    case 'REMOVE_USER_POSITION':
      return {
        ...state,
        userPositions: state.userPositions.filter(pos => pos.id !== action.payload)
      };
    
    case 'ADD_SPOT_POSITION':
      return { ...state, spotPositions: [action.payload, ...state.spotPositions] };
    
    case 'REMOVE_SPOT_POSITION':
      return {
        ...state,
        spotPositions: state.spotPositions.filter(pos => pos.id !== action.payload)
      };
    
    case 'SET_SPOT_ORDERS':
      return { ...state, spotOrders: action.payload };
    
    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_SELECTED_WALLET':
      return { ...state, selectedWallet: action.payload };
    
    case 'SET_DARK_MODE':
      return { ...state, darkMode: action.payload };
    
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    
    default:
      return state;
  }
}

// Context
const DEXContext = createContext<{
  state: DEXState;
  dispatch: React.Dispatch<DEXAction>;
  actions: {
    initializeApp: () => Promise<void>;
    connectWallet: (walletType: string) => Promise<void>;
    disconnectWallet: () => void;
    refreshBalances: () => Promise<void>;
    placeOrder: (orderData: OrderData) => Promise<void>;
    cancelOrder: (orderId: string) => Promise<void>;
    openPosition: (positionData: PositionData) => Promise<void>;
    closePosition: (positionId: string) => Promise<void>;
    selectTradingPair: (symbol: string) => void;
    bridgeTokens: (swapData: SwapData) => Promise<void>;
    stakeTokens: (asset: string, amount: string) => Promise<void>;
    claimRewards: (asset: string) => Promise<void>;
    closeSpotPosition: (positionId: string) => Promise<void>;
  };
} | null>(null);

// Provider component
export function DEXProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dexReducer, initialState);

  // Actions
  const actions = useMemo(() => ({
    initializeApp: async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // Load trading pairs
        const pairs = await dexApi.getTradingPairs();
        dispatch({ type: 'SET_TRADING_PAIRS', payload: pairs });
        
        if (pairs.length > 0) {
          dispatch({ type: 'SET_CURRENT_PAIR', payload: pairs[0] });
        }

        // Connect WebSocket
        const connected = await dexWebSocket.connect();
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: connected });

        // Load stored orders from localStorage
        const storedSpotOrders = dexStorage.get('spot_orders') || [];
        const spotOrders: Order[] = storedSpotOrders.map(order => ({
          ...order,
          price: order.price || '0', // Default to '0' if price is undefined
          filled: order.filled,
          remaining: order.remaining
        }));
        dispatch({ type: 'SET_SPOT_ORDERS', payload: spotOrders });
        
        // Convert filled spot orders to spot positions
        const spotPositions = spotOrders
          .filter((order) => order.status === 'filled' && order.side === 'buy')
          .map((order) => ({
            id: order.id,
            symbol: order.symbol,
            size: order.filled || order.amount,
            entryPrice: order.price,
            currentPrice: order.price, // Will be updated by real-time data
            pnl: '0', // Will be calculated based on current price
            timestamp: order.timestamp,
            type: 'spot'
          }));
        
        spotPositions.forEach((position) => {
          dispatch({ type: 'ADD_SPOT_POSITION', payload: position });
        });

        // Load user data only if wallet is connected
        if (state.selectedWallet && state.isConnected) {
          try {
            const balances = await dexApi.getUserBalances();
            dispatch({ type: 'SET_USER_BALANCES', payload: balances });
            
            const orders = await dexApi.getOrders();
            orders.forEach(order => {
              dispatch({ type: 'ADD_USER_ORDER', payload: order });
            });
            
            const positions = await dexApi.getPositions();
            positions.forEach(position => {
              dispatch({ type: 'ADD_USER_POSITION', payload: position });
            });
          } catch (userDataError) {
            console.warn('Failed to load user data:', userDataError);
          }
        }

      } catch (error) {
        console.error('Failed to initialize app:', error);
        toast.error('Failed to initialize application');
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    connectWallet: async (walletType: string) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        // Use enhanced wallet service for connection
        const walletState = await walletService.connect();
        
        if (!walletState.isConnected || !walletState.account) {
          throw new Error('Failed to get wallet connection state');
        }
        
        console.log(`Wallet connected: ${walletState.account}`);
        
        dispatch({ type: 'SET_SELECTED_WALLET', payload: walletType });
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
        
        // Set wallet connected flag for API service
        localStorage.setItem('wallet_connected', 'true');
        localStorage.setItem('connected_wallet', walletType);
        
        // Load user balances after wallet connection
        try {
          // Create mock balances from wallet state for now
          const mockBalances: UserBalance[] = [
            {
              asset: 'ETH',
              total: walletState.balance,
              available: walletState.balance,
              locked: '0'
            }
          ];
          
          // Get contract addresses for current chain if supported
          // Optionally include USDC with zero balance placeholder
          const contractAddresses = walletService.getContractAddresses();
          if (contractAddresses) {
            mockBalances.push({ asset: 'USDC', total: '0', available: '0', locked: '0' });
          }
          
          dispatch({ type: 'SET_USER_BALANCES', payload: mockBalances });
        } catch (balanceError) {
          console.warn('Failed to load balances:', balanceError);
          dispatch({ type: 'SET_USER_BALANCES', payload: [] });
        }
        
        toast.success(`${walletType} connected successfully!`);
        toast.info(`Address: ${walletState.account.slice(0, 6)}...${walletState.account.slice(-4)}`);
        
      } catch (error) {
        console.error('Wallet connection error:', error);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
        toast.error(`Failed to connect ${walletType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    disconnectWallet: async () => {
      try {
        // Disconnect using wallet service
        await walletService.disconnect();
        
        dispatch({ type: 'SET_SELECTED_WALLET', payload: null });
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
        dispatch({ type: 'SET_USER_BALANCES', payload: [] });
        dispatch({ type: 'SET_SPOT_ORDERS', payload: [] });
        
        // Clear wallet connected flag for API service
        localStorage.removeItem('wallet_connected');
        localStorage.removeItem('connected_wallet');
        
        toast.info('Wallet disconnected');
      } catch (error) {
        console.error('Failed to disconnect wallet:', error);
        toast.error('Failed to disconnect wallet');
      }
    },

    refreshBalances: async () => {
      if (!state.isConnected || !state.selectedWallet) {
        console.warn('No wallet connected, cannot refresh balances');
        return;
      }

      try {
        // Use wallet service to get current state
        const walletState = walletService.getState();
        
        if (!walletState.isConnected || !walletState.account) {
          console.warn('Wallet not connected in wallet service');
          return;
        }

        // Create mock balances from wallet state
        const mockBalances: UserBalance[] = [
          {
            asset: 'ETH',
            total: walletState.balance,
            available: walletState.balance,
            locked: '0'
          }
        ];
        
        // Get contract addresses for current chain if supported
        const contractAddresses = walletService.getContractAddresses();
        if (contractAddresses) {
          mockBalances.push({ asset: 'USDC', total: '0', available: '0', locked: '0' });
        }
        
        dispatch({ type: 'SET_USER_BALANCES', payload: mockBalances });
        
      } catch (error) {
        console.error('Failed to refresh balances:', error);
        toast.error('Failed to refresh balances');
      }
    },

    placeOrder: async (orderData: OrderData) => {
      try {
        const order = await dexApi.placeOrder(orderData);
        dispatch({ type: 'ADD_USER_ORDER', payload: order });
        
        // Store order in appropriate category
        const orderForStorage = {
          id: order.id,
          symbol: order.symbol,
          side: order.side as 'buy' | 'sell',
          type: order.type as 'market' | 'limit',
          amount: order.amount,
          price: order.price,
          status: order.status as 'pending' | 'filled' | 'cancelled',
          timestamp: Date.now()
        };
        
        const spotOrders = dexStorage.get('spot_orders') || [];
        dexStorage.set('spot_orders', [orderForStorage, ...spotOrders]);
        
        // If it's a filled buy order, create a spot position
        if (orderForStorage.status === 'filled' && orderData.side === 'buy') {
          const spotPosition = {
            id: `spot_pos_${Date.now()}`,
            symbol: orderData.symbol,
            size: orderData.amount,
            entryPrice: orderData.price,
            currentPrice: orderData.price,
            pnl: '0',
            timestamp: Date.now(),
            type: 'spot'
          };
          dispatch({ type: 'ADD_SPOT_POSITION', payload: spotPosition });
        }
        
        toast.success(`${orderData.side.toUpperCase()} order placed successfully!`);
      } catch (error) {
        toast.error('Failed to place order');
        throw error;
      }
    },

    cancelOrder: async (orderId: string) => {
      try {
        await dexApi.cancelOrder(orderId);
        dispatch({ type: 'UPDATE_ORDER_STATUS', payload: { orderId, status: 'cancelled' } });
        toast.success('Order cancelled successfully');
      } catch (error) {
        toast.error('Failed to cancel order');
        throw error;
      }
    },

    openPosition: async (positionData: PositionData) => {
      try {
        const position = await dexApi.openPosition(positionData);
        dispatch({ type: 'ADD_USER_POSITION', payload: position });
        
        // Store futures order in storage
        const futuresOrder = {
          id: `fut_${Date.now()}`,
          symbol: positionData.symbol,
          type: 'market' as 'market' | 'limit',
          side: positionData.side,
          amount: positionData.amount,
          price: positionData.price,
          status: 'filled' as 'pending' | 'filled' | 'cancelled',
          timestamp: Date.now()
        };
        
        const futuresOrders = dexStorage.get('futures_orders') || [];
        dexStorage.set('futures_orders', [futuresOrder, ...futuresOrders]);
        
        toast.success(`${positionData.side.toUpperCase()} position opened successfully!`);
      } catch (error) {
        toast.error('Failed to open position');
        throw error;
      }
    },

    closePosition: async (positionId: string) => {
      try {
        await dexApi.closePosition(positionId);
        dispatch({ type: 'REMOVE_USER_POSITION', payload: positionId });
        toast.success('Position closed successfully');
      } catch (error) {
        toast.error('Failed to close position');
        throw error;
      }
    },

    selectTradingPair: (symbol: string) => {
      const pair = state.tradingPairs.find(p => p.symbol === symbol);
      if (pair) {
        dispatch({ type: 'SET_CURRENT_PAIR', payload: pair });
      }
    },

    bridgeTokens: async (swapData: SwapData) => {
      try {
        // Store cross-chain swap order
        const swapOrder = {
          id: `swap_${Date.now()}`,
          fromChain: swapData.fromChain,
          toChain: swapData.toChain,
          fromToken: swapData.fromToken,
          toToken: swapData.toToken,
          amount: swapData.amount,
          status: 'pending' as 'pending' | 'completed' | 'failed',
          timestamp: Date.now()
        };
        
        const crossChainOrders = dexStorage.get('crosschain_orders') || [];
        dexStorage.set('crosschain_orders', [swapOrder, ...crossChainOrders]);
        
        // Simulate completion after random time
        setTimeout(() => {
          const updatedOrders = dexStorage.get('crosschain_orders') || [];
          const updated = updatedOrders.map(order => 
            order.id === swapOrder.id 
              ? { ...order, status: 'completed' as 'pending' | 'completed' | 'failed' }
              : order
          );
          dexStorage.set('crosschain_orders', updated);
        }, 3000 + Math.random() * 2000);
        
      } catch (error) {
        console.error('Failed to store swap order:', error);
      }
    },

    stakeTokens: async (asset: string, amount: string) => {
      try {
        await dexApi.stakeTokens(asset, amount);
        // Refresh balances after staking using real balance service
        await actions.refreshBalances();
        toast.success(`Successfully staked ${amount} ${asset}!`);
      } catch (error) {
        toast.error('Staking failed');
        throw error;
      }
    },

    claimRewards: async (asset: string) => {
      try {
        const rewards = await dexApi.getStakingRewards(asset);
        // Refresh balances after claiming using real balance service
        await actions.refreshBalances();
        toast.success(`Claimed ${rewards.amount} ${asset} rewards!`);
      } catch (error) {
        toast.error('Failed to claim rewards');
        throw error;
      }
    },

    closeSpotPosition: async (positionId: string) => {
      try {
        // Remove from spot positions
        dispatch({ type: 'REMOVE_SPOT_POSITION', payload: positionId });
        toast.success('Spot position closed successfully');
      } catch (error) {
        toast.error('Failed to close spot position');
        throw error;
      }
    },
  }), [state.selectedWallet, state.isConnected, state.tradingPairs]); // Add dependencies as needed

  // WebSocket event handlers
  useEffect(() => {
    const handlePriceUpdate = (message: WebSocketMessage) => {
      if (message.type === 'price_update') {
        Object.entries(message.data).forEach(([symbol, data]: [string, unknown]) => {
          if (typeof data === 'object' && data !== null && 'price' in data && 'change' in data) {
            const priceData = data as { price: string; change: string };
            dispatch({
              type: 'UPDATE_PRICE',
              payload: { symbol, price: priceData.price, change: priceData.change }
            });
          }
        });
      }
    };

    const handleOrderBookUpdate = (message: WebSocketMessage) => {
      if (message.type === 'order_update' && message.data.bids && message.data.asks) {
        const data = message.data as { bids: OrderBookEntry[]; asks: OrderBookEntry[] };
        dispatch({ type: 'SET_ORDER_BOOK', payload: data });
      }
    };

    const handleTradeUpdate = (message: WebSocketMessage) => {
      if (message.type === 'order_update' && message.data.symbol && typeof message.data.price === 'string' && typeof message.data.amount === 'string' && typeof message.data.side === 'string' && typeof message.data.timestamp === 'number') {
        const data: RecentTrade = {
          price: message.data.price,
          amount: message.data.amount,
          side: message.data.side as 'buy' | 'sell',
          timestamp: message.data.timestamp
        };
        dispatch({ type: 'ADD_RECENT_TRADE', payload: data });
      }
    };

    dexWebSocket.subscribe('price_updates', handlePriceUpdate);
    dexWebSocket.subscribe('orderbook_updates', handleOrderBookUpdate);
    dexWebSocket.subscribe('trade_updates', handleTradeUpdate);

    return () => {
      dexWebSocket.unsubscribe('price_updates', handlePriceUpdate);
      dexWebSocket.unsubscribe('orderbook_updates', handleOrderBookUpdate);
      dexWebSocket.unsubscribe('trade_updates', handleTradeUpdate);
    };
  }, []);

  // Initialize app on mount
  useEffect(() => {
    actions.initializeApp();
  }, [actions]);

  return (
    <DEXContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </DEXContext.Provider>
  );
}

// Custom hook
export function useDEX() {
  const context = useContext(DEXContext);
  if (!context) {
    throw new Error('useDEX must be used within a DEXProvider');
  }
  return context;
}