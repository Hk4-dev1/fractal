// Cross-Chain Types untuk Futures Trading
// Extend existing types tanpa merubah yang sudah ada

export interface CrossChainFuturesOrder {
  id: string;
  sourceChain: string;
  targetChain: string;
  orderData: FuturesOrderData;
  status: CrossChainOrderStatus;
  layerZeroTxHash?: string;
  targetTxHash?: string;
  fee: {
    nativeFee: string;
    lzTokenFee: string;
    estimated: boolean;
  };
  timestamp: number;
  deliveryTime?: number;
  errorMessage?: string;
}

export interface FuturesOrderData {
  user: string;
  baseToken: string;
  quoteToken: string;
  price: string;
  amount: string;
  leverage: number;
  margin: string;
  side: 'long' | 'short';
  orderType: 'market' | 'limit';
  timestamp: number;
}

export type CrossChainOrderStatus = 
  | 'preparing'    // Preparing order data
  | 'quoting'      // Getting fee quote
  | 'pending'      // Waiting for user confirmation
  | 'sending'      // Sending via LayerZero
  | 'sent'         // Sent, waiting for delivery
  | 'delivered'    // Delivered to target chain
  | 'executed'     // Successfully executed
  | 'failed'       // Failed at any stage
  | 'cancelled';   // Cancelled by user

export interface Network {
  id: string;
  name: string;
  chainId: number;
  eid: number; // LayerZero EID
  rpcUrl: string;
  relayContract: string;
  nativeToken: string;
  logo: string;
  color: string;
  isActive: boolean;
  blockExplorer: string;
}

export interface CrossChainQuote {
  nativeFee: string;
  lzTokenFee: string;
  estimatedDeliveryTime: number; // seconds
  gasLimit: number;
  success: boolean;
  error?: string;
}

export interface LayerZeroMessage {
  messageType: number;
  payload: string;
  options: string;
}

// Events from LayerZero
export interface LayerZeroEvent {
  type: 'PacketSent' | 'PacketReceived' | 'PacketDelivered';
  guid: string;
  srcEid: number;
  dstEid: number;
  message: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

// Cross-chain order tracking
export interface OrderTrackingData {
  orderId: string;
  sourceTransaction: {
    hash: string;
    blockNumber: number;
    confirmations: number;
  };
  layerZeroMessage?: {
    guid: string;
    srcEid: number;
    dstEid: number;
    sent: boolean;
    delivered: boolean;
  };
  targetTransaction?: {
    hash: string;
    blockNumber: number;
    success: boolean;
  };
  status: CrossChainOrderStatus;
  estimatedDelivery: number;
  actualDelivery?: number;
}
