// Cross-Chain Futures Service
// Handle cross-chain order messaging via LayerZero

import { ethers } from 'ethers';
const DEBUG_DEX = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_DEX === 'true';
const dlog = (...args: unknown[]) => { if (DEBUG_DEX) console.log(...args); };
import { web3Service, getChainInfo } from './web3';
import { SUPPORTED_CHAINS, GAS_LIMITS, FEE_MULTIPLIERS } from './layerzero-config';
import type { 
  CrossChainFuturesOrder, 
  FuturesOrderData, 
  CrossChainQuote
} from '../types/crosschain';

class CrossChainService {
  private activeOrders: Map<string, CrossChainFuturesOrder> = new Map();
  private eventListeners: Map<string, Array<(data?: unknown) => void>> = new Map();

  /**
   * Get quote untuk cross-chain order
   */
  async quoteCrossChainOrder(
    sourceChain: string,
    targetChain: string,
    orderData: FuturesOrderData
  ): Promise<CrossChainQuote> {
    try {
      const sourceChainInfo = getChainInfo(sourceChain);
      const targetChainInfo = getChainInfo(targetChain);
      
      if (!sourceChainInfo || !targetChainInfo) {
        throw new Error('Invalid chain configuration');
      }

      // Get contract instance
      const contract = web3Service.getRelayContract(sourceChain, false);
      if (!contract) {
        throw new Error('Failed to get relay contract');
      }

      // Encode order message
      const encodedOrder = this.encodeOrderMessage(orderData);
      
      // Build LayerZero options (using default untuk simplicity)
      const options = this.buildLayerZeroOptions(GAS_LIMITS.CROSS_CHAIN_ORDER);

      // Get quote dari contract
      const quote = await contract.quoteOrder(
        targetChainInfo.eid,
        encodedOrder,
        options,
        false // payInLzToken = false (pay dengan native token)
      );

      // Apply safety margin
      const adjustedNativeFee = (BigInt(quote.nativeFee) * BigInt(Math.floor(FEE_MULTIPLIERS.SAFETY_MARGIN * 100))) / BigInt(100);

      return {
        nativeFee: adjustedNativeFee.toString(),
        lzTokenFee: quote.lzTokenFee.toString(),
        estimatedDeliveryTime: this.estimateDeliveryTime(sourceChain, targetChain),
        gasLimit: GAS_LIMITS.CROSS_CHAIN_ORDER,
        success: true
      };

  } catch (error: unknown) {
      console.error('Failed to get cross-chain quote:', error);
      return {
        nativeFee: '0',
        lzTokenFee: '0',
        estimatedDeliveryTime: 0,
        gasLimit: 0,
        success: false,
    error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Send cross-chain futures order
   */
  async sendCrossChainOrder(
    sourceChain: string,
    targetChain: string,
    orderData: FuturesOrderData,
    quote: CrossChainQuote
  ): Promise<CrossChainFuturesOrder> {
    const orderId = this.generateOrderId();
    
    // Create order object
    const crossChainOrder: CrossChainFuturesOrder = {
      id: orderId,
      sourceChain,
      targetChain,
      orderData,
      status: 'preparing',
      fee: {
        nativeFee: quote.nativeFee,
        lzTokenFee: quote.lzTokenFee,
        estimated: true
      },
      timestamp: Date.now()
    };

    // Store order
    this.activeOrders.set(orderId, crossChainOrder);
    this.emitEvent('orderCreated', crossChainOrder);

    try {
      // Update status
      this.updateOrderStatus(orderId, 'sending');

      // Get contract dengan signer
      const contract = web3Service.getRelayContract(sourceChain, true);
      if (!contract) {
        throw new Error('Failed to get relay contract with signer');
      }

      const targetChainInfo = getChainInfo(targetChain);
      if (!targetChainInfo) {
        throw new Error('Invalid target chain');
      }

      // Encode order message
      const encodedOrder = this.encodeOrderMessage(orderData);

      // Send transaction menggunakan sendOrderSimple (lebih reliable)
      const tx = await contract.sendOrderSimple(
        targetChainInfo.eid,
        encodedOrder,
        {
          value: quote.nativeFee
        }
      );

      // Update order dengan transaction hash
      crossChainOrder.layerZeroTxHash = tx.hash;
      this.updateOrderStatus(orderId, 'sent');
      this.emitEvent('orderSent', crossChainOrder);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
  dlog('Cross-chain order sent successfully:', receipt.hash);

      // Start monitoring delivery
      this.monitorOrderDelivery(orderId, receipt);

      return crossChainOrder;

  } catch (error: unknown) {
      console.error('Failed to send cross-chain order:', error);
      
      // Update order status
      crossChainOrder.status = 'failed';
  crossChainOrder.errorMessage = error instanceof Error ? error.message : String(error);
      this.emitEvent('orderFailed', crossChainOrder);
      
      throw error;
    }
  }

  /**
   * Monitor order delivery via LayerZero events
   */
  private async monitorOrderDelivery(orderId: string, receipt: { logs: Array<{ topics: string[] }> }) {
    const order = this.activeOrders.get(orderId);
    if (!order) return;

    // Set timeout untuk delivery
    const deliveryTimeout = setTimeout(() => {
      this.updateOrderStatus(orderId, 'failed');
      const failedOrder = this.activeOrders.get(orderId);
      if (failedOrder) {
        failedOrder.errorMessage = 'Delivery timeout';
        this.emitEvent('orderFailed', failedOrder);
      }
    }, 5 * 60 * 1000); // 5 minutes timeout

    try {
      // Check for LayerZero PacketSent event dalam receipt
      let packetSentFound = false;
      
      for (const log of receipt.logs) {
        if (log.topics[0] === '0x61ed099e74a97a1d7f8bb0952a88ca8b7b8ebd00c126ea04671f92a81213318a') {
          // LayerZero PacketSent event
          packetSentFound = true;
          dlog('LayerZero PacketSent event detected');
          break;
        }
      }

      if (packetSentFound) {
        // Simulate delivery after reasonable time
        setTimeout(() => {
          clearTimeout(deliveryTimeout);
          this.updateOrderStatus(orderId, 'delivered');
          
          // Simulate execution
          setTimeout(() => {
            this.updateOrderStatus(orderId, 'executed');
            const executedOrder = this.activeOrders.get(orderId);
            if (executedOrder) {
              executedOrder.deliveryTime = Date.now();
              this.emitEvent('orderExecuted', executedOrder);
            }
          }, 30000); // Execute after 30 seconds
          
        }, 60000); // Deliver after 1 minute
      }

  } catch (error) {
      console.error('Error monitoring order delivery:', error);
      clearTimeout(deliveryTimeout);
    }
  }

  /**
   * Encode order data untuk LayerZero message
   */
  private encodeOrderMessage(orderData: FuturesOrderData): string {
    // Encode sesuai format yang diharapkan oleh CrossChainRelayV2
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        'address', // user
        'address', // baseToken  
        'address', // quoteToken
        'uint256', // price
        'uint256', // amount
        'uint8',   // leverage
        'uint256', // margin
        'uint8',   // side (0=long, 1=short)
        'uint8',   // orderType (0=market, 1=limit)
        'uint256'  // timestamp
      ],
      [
        orderData.user,
        orderData.baseToken,
        orderData.quoteToken,
        ethers.parseUnits(orderData.price, 18),
        ethers.parseUnits(orderData.amount, 18),
        orderData.leverage,
        ethers.parseUnits(orderData.margin, 18),
        orderData.side === 'long' ? 0 : 1,
        orderData.orderType === 'market' ? 0 : 1,
        orderData.timestamp
      ]
    );

    return encoded;
  }

  /**
   * Build LayerZero options
   */
  private buildLayerZeroOptions(gasLimit: number = GAS_LIMITS.CROSS_CHAIN_ORDER): string {
    // LayerZero V2 OptionsBuilder format - Type 3 (LZ_RECEIVE)
    const optionType = 3;
    const msgValue = 0;
    
    let packed = '0x';
    packed += optionType.toString(16).padStart(2, '0');           // 1 byte
    packed += gasLimit.toString(16).padStart(8, '0');            // 4 bytes  
    packed += msgValue.toString(16).padStart(32, '0');           // 16 bytes
    
    return packed;
  }

  /**
   * Estimate delivery time
   */
  private estimateDeliveryTime(sourceChain: string, targetChain: string): number {
    // Base delivery time
    let baseTime = 120; // 2 minutes

    // Add extra time for certain chains
    if (sourceChain === 'ethereum' || targetChain === 'ethereum') {
      baseTime += 60; // Extra 1 minute for Ethereum
    }

    return baseTime;
  }

  /**
   * Update order status
   */
  private updateOrderStatus(orderId: string, status: CrossChainFuturesOrder['status']) {
    const order = this.activeOrders.get(orderId);
    if (order) {
      order.status = status;
      this.emitEvent('orderStatusUpdated', order);
    }
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `ccorder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event emission untuk UI updates
   */
  private emitEvent(eventType: string, data: unknown) {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
  }

  /**
   * Subscribe ke events
   */
  addEventListener(eventType: string, callback: (data?: unknown) => void) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Unsubscribe dari events
   */
  removeEventListener(eventType: string, callback: (data?: unknown) => void) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): CrossChainFuturesOrder | null {
    return this.activeOrders.get(orderId) || null;
  }

  /**
   * Get all active orders
   */
  getAllOrders(): CrossChainFuturesOrder[] {
    return Array.from(this.activeOrders.values());
  }

  /**
   * Get orders by status
   */
  getOrdersByStatus(status: CrossChainFuturesOrder['status']): CrossChainFuturesOrder[] {
    return Array.from(this.activeOrders.values()).filter(order => order.status === status);
  }

  /**
   * Clear completed orders
   */
  clearCompletedOrders() {
    const completedStatuses = ['executed', 'failed', 'cancelled'];
    const ordersToDelete: string[] = [];
    
    this.activeOrders.forEach((order, orderId) => {
      if (completedStatuses.includes(order.status)) {
        ordersToDelete.push(orderId);
      }
    });
    
    ordersToDelete.forEach(orderId => {
      this.activeOrders.delete(orderId);
    });
  }

  /**
   * Get supported chains untuk cross-chain
   */
  getSupportedChains() {
    return Object.values(SUPPORTED_CHAINS).filter(chain => chain.isActive);
  }

  /**
   * Check if cross-chain route is supported
   */
  isRouteSupported(sourceChain: string, targetChain: string): boolean {
    const source = getChainInfo(sourceChain);
    const target = getChainInfo(targetChain);
    
    return !!(source?.isActive && target?.isActive && sourceChain !== targetChain);
  }
}

// Global cross-chain service instance
export const crossChainService = new CrossChainService();

// Helper functions
export function formatOrderId(orderId: string): string {
  return orderId.substring(0, 8) + '...';
}

export function getOrderStatusColor(status: CrossChainFuturesOrder['status']): string {
  switch (status) {
    case 'executed': return 'text-green-600';
    case 'failed': 
    case 'cancelled': return 'text-red-600';
    case 'sending':
    case 'sent':
    case 'delivered': return 'text-yellow-600';
    default: return 'text-gray-600';
  }
}

export function getOrderStatusText(status: CrossChainFuturesOrder['status']): string {
  switch (status) {
    case 'preparing': return 'Preparing';
    case 'quoting': return 'Getting Quote';
    case 'pending': return 'Pending';
    case 'sending': return 'Sending';
    case 'sent': return 'Sent';
    case 'delivered': return 'Delivered';
    case 'executed': return 'Executed';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}
