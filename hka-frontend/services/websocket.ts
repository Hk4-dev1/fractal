// WebSocket service simulation untuk real-time data

const DEBUG_DEX = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_DEX === 'true';
const dlog = (...args: unknown[]) => { if (DEBUG_DEX) console.log(...args); };

export interface WebSocketMessage {
  type: 'price_update' | 'order_update' | 'position_update' | 'balance_update';
  data: Record<string, unknown>;
  timestamp: number;
}

class DEXWebSocketService {
  private callbacks: Map<string, ((message: WebSocketMessage) => void)[]> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      // Simulate connection delay
      setTimeout(() => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
  dlog('DEX WebSocket connected');
        
        // Start sending mock real-time data
        this.startDataStreams();
        resolve(true);
      }, 1000);
    });
  }

  disconnect() {
    this.isConnected = false;
  dlog('DEX WebSocket disconnected');
  }

  subscribe(channel: string, callback: (message: WebSocketMessage) => void) {
    if (!this.callbacks.has(channel)) {
      this.callbacks.set(channel, []);
    }
    this.callbacks.get(channel)?.push(callback);
  }

  unsubscribe(channel: string, callback: (message: WebSocketMessage) => void) {
    const channelCallbacks = this.callbacks.get(channel);
    if (channelCallbacks) {
      const index = channelCallbacks.indexOf(callback);
      if (index > -1) {
        channelCallbacks.splice(index, 1);
      }
    }
  }

  private emit(channel: string, message: WebSocketMessage) {
    const channelCallbacks = this.callbacks.get(channel);
    if (channelCallbacks) {
      channelCallbacks.forEach(callback => callback(message));
    }
  }

  private startDataStreams() {
    // Price updates every 2 seconds
    setInterval(() => {
      if (this.isConnected) {
        const priceData = {
          'BTCUSDT': {
            price: (43523.75 + (Math.random() - 0.5) * 100).toFixed(2),
            change: ((Math.random() - 0.5) * 5).toFixed(2),
            volume: (Math.random() * 1000000000 + 500000000).toFixed(0)
          },
          'ETHUSDT': {
            price: (2567.89 + (Math.random() - 0.5) * 50).toFixed(2),
            change: ((Math.random() - 0.5) * 3).toFixed(2),
            volume: (Math.random() * 500000000 + 200000000).toFixed(0)
          },
          'BNBUSDT': {
            price: (315.42 + (Math.random() - 0.5) * 10).toFixed(2),
            change: ((Math.random() - 0.5) * 2).toFixed(2),
            volume: (Math.random() * 100000000 + 50000000).toFixed(0)
          }
        };

        this.emit('price_updates', {
          type: 'price_update',
          data: priceData,
          timestamp: Date.now()
        });
      }
    }, 2000);

    // Order book updates every 5 seconds
    setInterval(() => {
      if (this.isConnected) {
        const orderBookData = this.generateOrderBookUpdate();
        this.emit('orderbook_updates', {
          type: 'order_update',
          data: orderBookData,
          timestamp: Date.now()
        });
      }
    }, 5000);

    // Random trade executions
    setInterval(() => {
      if (this.isConnected && Math.random() < 0.3) {
        const tradeData = {
          symbol: 'BTCUSDT',
          price: (43523.75 + (Math.random() - 0.5) * 50).toFixed(2),
          quantity: (Math.random() * 2).toFixed(6),
          side: Math.random() > 0.5 ? 'buy' : 'sell',
          timestamp: Date.now()
        };

        this.emit('trade_updates', {
          type: 'order_update',
          data: tradeData,
          timestamp: Date.now()
        });
      }
    }, 3000);
  }

  private generateOrderBookUpdate() {
    const basePrice = 43523.75;
    const spread = 2.5;

    const bids = Array.from({ length: 10 }, (_, i) => ({
      price: (basePrice - spread - i * 0.25).toFixed(2),
      quantity: (Math.random() * 5 + 0.1).toFixed(6),
      total: 0
    }));

    const asks = Array.from({ length: 10 }, (_, i) => ({
      price: (basePrice + spread + i * 0.25).toFixed(2),
      quantity: (Math.random() * 5 + 0.1).toFixed(6),
      total: 0
    }));

    // Calculate totals
    let bidTotal = 0;
    let askTotal = 0;
    
    bids.forEach(bid => {
      bidTotal += parseFloat(bid.quantity);
      bid.total = bidTotal;
    });

    asks.forEach(ask => {
      askTotal += parseFloat(ask.quantity);
      ask.total = askTotal;
    });

    return { bids, asks, symbol: 'BTCUSDT' };
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Simulate connection issues for testing
  simulateDisconnection() {
    this.isConnected = false;
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
  dlog(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, 2000 * this.reconnectAttempts);
    }
  }
}

export const dexWebSocket = new DEXWebSocketService();