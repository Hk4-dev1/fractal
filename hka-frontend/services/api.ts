import { dexStorage } from '../utils/storage';

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: string;
  change24h: string;
  volume24h: string;
  high24h: string;
  low24h: string;
}

export interface Order {
  id: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell' | 'long' | 'short';
  amount: string;
  price: string;
  status: 'pending' | 'filled' | 'cancelled' | 'partial';
  timestamp: number;
  filled?: string;
  remaining?: string;
  network?: string;
  total?: string;
  fee?: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  markPrice?: string;
  pnl: string;
  margin: string;
  leverage: number;
  liquidationPrice?: string;
  network?: string;
  timestamp: number;
}

export interface UserBalance {
  asset: string;
  available: string;
  locked: string;
  total: string;
}

// Mock API implementation
class DEXApi {
  private baseDelay = 500;

  private delay(ms: number = this.baseDelay): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getTradingPairs(): Promise<TradingPair[]> {
    await this.delay();
    return [
      {
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT', 
        price: '43523.75',
        change24h: '+2.34',
        volume24h: '2150000000',
        high24h: '44125.50',
        low24h: '42890.75'
      },
      {
        symbol: 'ETHUSDT',
        baseAsset: 'ETH', 
        quoteAsset: 'USDT',
        price: '2567.89',
        change24h: '-1.23',
        volume24h: '1800000000',
        high24h: '2625.50',
        low24h: '2485.30'
      },
      {
        symbol: 'BNBUSDT',
        baseAsset: 'BNB',
        quoteAsset: 'USDT',
        price: '315.42',
        change24h: '+0.87',
        volume24h: '456000000',
        high24h: '325.80',
        low24h: '308.90'
      }
    ];
  }

  async getUserBalances(): Promise<UserBalance[]> {
    await this.delay();
    
    // Check if wallet is connected from localStorage or context
    const walletConnected = localStorage.getItem('wallet_connected') === 'true';
    
    if (!walletConnected) {
      return []; // Return empty balances if no wallet connected
    }
    
    // Generate realistic mock balances only when wallet is connected
    return [
      {
        asset: 'USDT',
        available: '25000.00',
        locked: '500.00',
        total: '25500.00'
      },
      {
        asset: 'BTC', 
        available: '0.25',
        locked: '0.01',
        total: '0.26'
      },
      {
        asset: 'ETH',
        available: '3.50',
        locked: '0.15',
        total: '3.65'
      },
      {
        asset: 'BNB',
        available: '15.75',
        locked: '0.25',
        total: '16.00'
      }
    ];
  }

  async getOrders(): Promise<Order[]> {
    await this.delay();
    return [];
  }

  async getPositions(): Promise<Position[]> {
    await this.delay();
    return [];
  }

  async placeOrder(orderData: {
    symbol: string;
    side: 'buy' | 'sell';
    amount: string;
    price: string;
    type?: 'market' | 'limit';
  }): Promise<Order> {
    await this.delay(1000);
    
    // Validate order data
    if (!orderData.symbol || !orderData.side || !orderData.amount || !orderData.price) {
      throw new Error('Invalid order data');
    }

    const amount = parseFloat(orderData.amount);
    const price = parseFloat(orderData.price);
    
    if (amount <= 0 || price <= 0) {
      throw new Error('Amount and price must be positive');
    }

    // Check available balance (simplified)
    const totalValue = amount * price;
    if (totalValue > 10000) { // Mock balance check
      throw new Error('Insufficient balance');
    }

    const order: Order = {
      id: this.generateId(),
      symbol: orderData.symbol,
      type: orderData.type || 'limit',
      side: orderData.side,
      amount: orderData.amount,
      price: orderData.price,
      status: 'pending',
      timestamp: Date.now(),
      filled: '0',
      remaining: orderData.amount
    };

    // Simulate order processing
    setTimeout(() => {
      // Random fill simulation (70% chance of filling)
      if (Math.random() > 0.3) {
        const storage = dexStorage.get('spot_orders') || [];
        const updated = storage.map((o: {
          id: string;
          symbol: string;
          side: 'buy' | 'sell';
          type: 'market' | 'limit';
          amount: string;
          price?: string;
          status: 'pending' | 'filled' | 'cancelled';
          timestamp: number;
          filled?: string;
          remaining?: string;
        }) =>
          o.id === order.id 
            ? { ...o, status: 'filled' as const, filled: o.amount, remaining: '0' }
            : o
        );
        dexStorage.set('spot_orders', updated as typeof storage);
      }
    }, 2000 + Math.random() * 3000);

    return order;
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.delay();
    // Mock cancel - always succeeds
    console.log(`Order ${orderId} cancelled`);
  }

  async openPosition(positionData: {
    symbol: string;
    side: 'long' | 'short';
    amount: string;
    leverage: number;
    entryPrice?: string;
  }): Promise<Position> {
    await this.delay(1500);
    
    // Validate position data
    if (!positionData.symbol || !positionData.side || !positionData.amount || !positionData.leverage) {
      throw new Error('Invalid position data');
    }

    const totalPositionValue = parseFloat(positionData.amount); // Size is already total position value from frontend
    const price = parseFloat(positionData.entryPrice || '0');
    const leverage = positionData.leverage;
    
    if (totalPositionValue <= 0 || price <= 0 || leverage < 1 || leverage > 125) {
      throw new Error('Invalid position parameters');
    }

    // Calculate margin requirement - FIXED LOGIC
    // Frontend sends total position value, so margin = position value / leverage
    const requiredMargin = totalPositionValue / leverage;
    
    // Get user's USDT balance (simulate)
    const balances = await this.getUserBalances();
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    const availableBalance = parseFloat(usdtBalance?.available || '0');
    
    // Check if user has enough margin
    if (requiredMargin > availableBalance) {
      throw new Error(`Insufficient margin. Required: ${requiredMargin.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`);
    }

    // Create position
    const position: Position = {
      id: this.generateId(),
      symbol: positionData.symbol,
      side: positionData.side,
      size: totalPositionValue.toFixed(2), // Store as position value for consistency
      entryPrice: positionData.entryPrice || '0',
      markPrice: positionData.entryPrice || '0',
      pnl: '0.00',
      margin: requiredMargin.toFixed(2),
      leverage: leverage,
      liquidationPrice: positionData.side === 'long' 
        ? (price * (1 - 1/leverage)).toFixed(2)
        : (price * (1 + 1/leverage)).toFixed(2),
      timestamp: Date.now()
    };

    return position;
  }

  async closePosition(positionId: string): Promise<void> {
    await this.delay();
    // Mock close - always succeeds
    console.log(`Position ${positionId} closed`);
  }

  async getWalletAddress(walletType: string): Promise<string> {
    await this.delay(2000);
    
    // Simulate wallet connection
    const addresses = {
      'MetaMask': '0x742d35Cc6460C0532a6c3E8e5F04F4eBc3A0eD95',
      'Trust Wallet': '0x8ba1f109551bD432803012645Hac136c30E6b1F4',
      'WalletConnect': '0x1A2B3c4D5e6F7890aBcDeF123456789012345678'
    };
    
    return addresses[walletType as keyof typeof addresses] || addresses['MetaMask'];
  }

  async stakeTokens(_asset: string, _amount: string): Promise<void> {
    await this.delay();
    
    const stakeAmount = parseFloat(_amount);
    if (stakeAmount <= 0) {
      throw new Error('Invalid staking amount');
    }
    
    // Mock staking - always succeeds
  }

  async getStakingRewards(asset: string): Promise<{ amount: string; asset: string }> {
    await this.delay();
    
    // Mock rewards calculation
    const rewardAmount = (Math.random() * 10).toFixed(6);
    return {
      amount: rewardAmount,
      asset: asset
    };
  }
}

export const dexApi = new DEXApi();