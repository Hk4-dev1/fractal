# HKA-DEX Backend Integration Guide

## Overview
This guide explains how to integrate the HKA-DEX frontend with a real backend system. The current implementation uses mock services that can be easily replaced with real API calls.

## Architecture

### Current Mock Implementation
```
Frontend (React) → Mock API Services → Simulated Data
                ↘ Mock WebSocket → Real-time Updates
```

### Production Architecture
```
Frontend (React) → API Gateway → Backend Services
                ↘ WebSocket → Real-time Data Feeds
                              ↘ Database (MongoDB/PostgreSQL)
                              ↘ Blockchain Integration
                              ↘ External APIs (CoinGecko, etc.)
```

## Backend Services Needed

### 1. User Authentication & Wallet Management
- **Wallet Connection**: Integrate with Web3 providers (MetaMask, WalletConnect)
- **User Sessions**: JWT-based authentication
- **Account Management**: User profiles, settings, preferences

### 2. Trading Engine
- **Order Management**: Place, cancel, modify orders
- **Order Matching**: Real-time order matching engine
- **Position Management**: Futures positions, margin calculations
- **Risk Management**: Stop-loss, take-profit, liquidation engine

### 3. Market Data Services
- **Price Feeds**: Real-time cryptocurrency prices
- **Order Book**: Live bid/ask data
- **Trade History**: Recent trades and volume data
- **Chart Data**: OHLCV data for different timeframes

### 4. Portfolio Management
- **Balance Tracking**: Real-time asset balances
- **P&L Calculations**: Profit/loss tracking
- **Transaction History**: Complete trading history
- **Reporting**: Performance analytics

### 5. Staking & DeFi Integration
- **Staking Pools**: Various staking opportunities
- **Yield Farming**: DeFi protocols integration
- **Rewards Distribution**: Automatic reward calculations
- **Cross-chain Bridge**: Multi-blockchain support

## API Endpoints Structure

### Authentication
```typescript
POST /api/v1/auth/connect-wallet
POST /api/v1/auth/verify-signature
POST /api/v1/auth/refresh-token
DELETE /api/v1/auth/logout
```

### Market Data
```typescript
GET /api/v1/market/pairs
GET /api/v1/market/ticker/:symbol
GET /api/v1/market/orderbook/:symbol
GET /api/v1/market/trades/:symbol
GET /api/v1/market/klines/:symbol
```

### Trading
```typescript
POST /api/v1/trading/order
GET /api/v1/trading/orders
DELETE /api/v1/trading/order/:orderId
PUT /api/v1/trading/order/:orderId

POST /api/v1/futures/position
GET /api/v1/futures/positions
DELETE /api/v1/futures/position/:positionId
```

### User Data
```typescript
GET /api/v1/user/balances
GET /api/v1/user/orders
GET /api/v1/user/trades
GET /api/v1/user/positions
PUT /api/v1/user/settings
```

### Staking
```typescript
GET /api/v1/staking/pools
POST /api/v1/staking/stake
POST /api/v1/staking/unstake
POST /api/v1/staking/claim-rewards
GET /api/v1/staking/rewards/:asset
```

## WebSocket Events

### Real-time Data Streams
```typescript
// Price updates
'ticker@{symbol}' → { symbol, price, change, volume }

// Order book updates
'depth@{symbol}' → { symbol, bids, asks }

// Trade updates
'trade@{symbol}' → { symbol, price, quantity, time, side }

// User updates
'balance@{userId}' → { asset, available, locked }
'order@{userId}' → { orderId, status, filledQty }
'position@{userId}' → { positionId, pnl, margin }
```

## Database Schema

### Core Tables
```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  email VARCHAR(255),
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Assets
CREATE TABLE assets (
  id UUID PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  decimals INTEGER NOT NULL,
  contract_address VARCHAR(42),
  chain_id INTEGER,
  is_active BOOLEAN DEFAULT TRUE
);

-- Trading Pairs
CREATE TABLE trading_pairs (
  id UUID PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  base_asset_id UUID REFERENCES assets(id),
  quote_asset_id UUID REFERENCES assets(id),
  min_order_size DECIMAL(36,18),
  max_order_size DECIMAL(36,18),
  tick_size DECIMAL(36,18),
  is_active BOOLEAN DEFAULT TRUE
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  pair_id UUID REFERENCES trading_pairs(id),
  type VARCHAR(10) NOT NULL, -- 'limit', 'market'
  side VARCHAR(4) NOT NULL,  -- 'buy', 'sell'
  amount DECIMAL(36,18) NOT NULL,
  price DECIMAL(36,18),
  filled_amount DECIMAL(36,18) DEFAULT 0,
  status VARCHAR(20) NOT NULL, -- 'pending', 'filled', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trades
CREATE TABLE trades (
  id UUID PRIMARY KEY,
  pair_id UUID REFERENCES trading_pairs(id),
  buyer_order_id UUID REFERENCES orders(id),
  seller_order_id UUID REFERENCES orders(id),
  price DECIMAL(36,18) NOT NULL,
  quantity DECIMAL(36,18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User Balances
CREATE TABLE user_balances (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  asset_id UUID REFERENCES assets(id),
  available DECIMAL(36,18) DEFAULT 0,
  locked DECIMAL(36,18) DEFAULT 0,
  UNIQUE(user_id, asset_id)
);

-- Positions (Futures)
CREATE TABLE positions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  pair_id UUID REFERENCES trading_pairs(id),
  side VARCHAR(5) NOT NULL, -- 'long', 'short'
  size DECIMAL(36,18) NOT NULL,
  entry_price DECIMAL(36,18) NOT NULL,
  leverage INTEGER NOT NULL,
  margin DECIMAL(36,18) NOT NULL,
  unrealized_pnl DECIMAL(36,18) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Blockchain Integration

### Smart Contracts
```solidity
// Trading Contract
contract DEXTrading {
    function placeOrder(
        address token,
        uint256 amount,
        uint256 price,
        bool isBuy
    ) external;
    
    function cancelOrder(uint256 orderId) external;
    function executeOrder(uint256 orderId) external;
}

// Staking Contract
contract DEXStaking {
    function stake(address token, uint256 amount) external;
    function unstake(address token, uint256 amount) external;
    function claimRewards(address token) external;
    function getRewards(address user, address token) external view returns (uint256);
}
```

### Integration Steps

1. **Setup Web3 Provider**
```typescript
import { ethers } from 'ethers';

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const contract = new ethers.Contract(contractAddress, abi, signer);
```

2. **Replace Mock API Calls**
```typescript
// Before (Mock)
const order = await dexApi.placeOrder(orderData);

// After (Real)
const response = await fetch('/api/v1/trading/order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(orderData)
});
const order = await response.json();
```

3. **Implement Real WebSocket**
```typescript
const ws = new WebSocket('wss://api.hka-dex.com/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle real-time updates
};
```

## Security Considerations

### Authentication
- Use wallet signature verification for authentication
- Implement JWT tokens with short expiration
- Rate limiting on all endpoints
- CORS configuration for frontend domains

### Trading Security
- Order validation and sanitization
- Balance checks before order placement
- Anti-manipulation measures
- Transaction monitoring

### Infrastructure
- HTTPS/WSS only
- Database encryption at rest
- Regular security audits
- DDoS protection

## Deployment Architecture

### Recommended Stack
- **Frontend**: Vercel/Netlify
- **API Gateway**: Kong/AWS API Gateway
- **Backend**: Node.js/Python with Express/FastAPI
- **Database**: PostgreSQL with Redis caching
- **WebSocket**: Socket.io/native WebSocket
- **Blockchain**: Infura/Alchemy for Ethereum
- **Monitoring**: DataDog/New Relic

### Environment Configuration
```env
# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Blockchain
ETHEREUM_RPC_URL=https://mainnet.infura.io/...
PRIVATE_KEY=...

# JWT
JWT_SECRET=...
JWT_EXPIRES_IN=1h

# External APIs
COINGECKO_API_KEY=...
COINMARKETCAP_API_KEY=...
```

## Migration Plan

1. **Phase 1**: Replace authentication with real wallet integration
2. **Phase 2**: Implement real market data feeds
3. **Phase 3**: Add real trading functionality
4. **Phase 4**: Integrate staking and DeFi features
5. **Phase 5**: Add advanced features (analytics, social trading)

## Testing Strategy

### Unit Tests
- API endpoint testing
- Smart contract testing
- Frontend component testing

### Integration Tests
- Full trading flow testing
- WebSocket connection testing
- Database transaction testing

### Load Testing
- High-frequency trading simulation
- Concurrent user testing
- WebSocket stress testing

This guide provides a comprehensive roadmap for transitioning from the current mock implementation to a production-ready DEX platform.