import { BrowserProvider, Signer, Contract, AbiCoder } from 'ethers';
import { CONTRACTS } from './contracts';

// LayerZero Relay ABI (minimal required functions)
const LAYERZERO_RELAY_ABI = [
  'function sendOrder(uint32 _dstEid, bytes calldata _order, bytes calldata _options) external payable',
  'function quote(uint32 _dstEid, bytes calldata _message, bytes calldata _options, bool _payInLzToken) external view returns (uint256 nativeFee, uint256 lzTokenFee)',
  'function orderBookEngine() external view returns (address)',
  'function trustedRemote(uint32) external view returns (address)',
  'event CrossChainOrderReceived(bytes32 indexed fromChain, bytes32 guid, bytes orderData)',
  'event CrossChainOrderExecuted(bytes32 indexed fromChain, bytes32 guid, uint256 orderId)',
  'event CrossChainOrderError(bytes32 indexed fromChain, bytes32 guid, string reason)'
];

export interface CrossChainOrder {
  baseToken: string;
  quoteToken: string;
  price: string; // in wei
  amount: string; // in wei
  leverage: number;
  margin: string; // in wei
  side: 'long' | 'short';
  fromChain: number;
  toChain: number;
}

export interface CrossChainQuote {
  nativeFee: string; // in wei
  lzTokenFee: string; // in wei
  gasCost: string; // estimated total cost
}

export class CrossChainService {
  private provider: BrowserProvider | null = null;
  private signer: Signer | null = null;

  constructor(provider?: BrowserProvider) {
    if (provider) {
      this.provider = provider;
      // Note: getSigner() returns a Promise, but we'll handle it in ensureProvider
      this.signer = null; // Will be set in ensureProvider
    }
  }

  async ensureProvider(): Promise<void> {
    if (!this.provider) {
      if (typeof window !== 'undefined' && window.ethereum) {
        this.provider = new BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();
      } else {
        throw new Error('MetaMask not found');
      }
    }
  }

  // Basic method to place a cross-chain futures order
  async placeCrossChainOrder(order: CrossChainOrder): Promise<string> {
    await this.ensureProvider();
    
    try {
      // Get contracts for source chain
      const srcChainConfig = CONTRACTS[order.fromChain as keyof typeof CONTRACTS];
      if (!srcChainConfig) {
        throw new Error(`Unsupported source chain: ${order.fromChain}`);
      }

      // Create contract instance
      const relayContract = new Contract(
        srcChainConfig.layerZeroRelay,
        LAYERZERO_RELAY_ABI,
        (() => {
          if (!this.signer) throw new Error('Wallet signer not available');
          return this.signer;
        })()
      );

      // Encode order data
      const encodedOrder = this.encodeOrder(order);
      
      // Get destination endpoint ID
      const dstEid = this.getLayerZeroEndpointId(order.toChain);
      
      // Get quote for cross-chain message
      const quote = await this.getQuote(order.fromChain, order.toChain, encodedOrder);
      
      // Send cross-chain order
      const tx = await relayContract.sendOrder(
        dstEid,
        encodedOrder,
        '0x', // options (empty for now)
        { value: quote.nativeFee }
      );

      console.log('Cross-chain order transaction sent:', tx.hash);
      return tx.hash;
    } catch (error: unknown) {
      console.error('Failed to place cross-chain order:', error);
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Cross-chain order failed: ${msg}`);
    }
  }

  // Get quote for cross-chain messaging
  async getQuote(fromChain: number, toChain: number, orderData: string): Promise<CrossChainQuote> {
    await this.ensureProvider();
    
    try {
      const srcChainConfig = CONTRACTS[fromChain as keyof typeof CONTRACTS];
      if (!srcChainConfig) {
        throw new Error(`Unsupported source chain: ${fromChain}`);
      }

      const relayContract = new Contract(
        srcChainConfig.layerZeroRelay,
        LAYERZERO_RELAY_ABI,
        this.provider
      );

      const dstEid = this.getLayerZeroEndpointId(toChain);
      const [nativeFee, lzTokenFee] = await relayContract.quote(
        dstEid,
        orderData,
        '0x', // options
        false // payInLzToken
      );

      return {
        nativeFee: nativeFee.toString(),
        lzTokenFee: lzTokenFee.toString(),
        gasCost: nativeFee.toString() // simplified for now
      };
    } catch (error: unknown) {
      console.error('Failed to get cross-chain quote:', error);
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Quote failed: ${msg}`);
    }
  }

  // Encode order data for cross-chain transmission
  private encodeOrder(order: CrossChainOrder): string {
    try {
      return AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
        [
          order.baseToken,
          order.quoteToken,
          order.price,
          order.amount,
          order.leverage,
          order.margin,
          order.side === 'long'
        ]
      );
    } catch (error: unknown) {
      console.error('Failed to encode order:', error);
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Order encoding failed: ${msg}`);
    }
  }

  // Get LayerZero endpoint ID for chain
  private getLayerZeroEndpointId(chainId: number): number {
    const endpointMap: { [key: number]: number } = {
      11155111: 40161, // Ethereum Sepolia
  421614: 40243,   // Arbitrum Sepolia
      11155420: 40232, // Optimism Sepolia
      84532: 40245     // Base Sepolia
    };
    
    const eid = endpointMap[chainId];
    if (!eid) {
      throw new Error(`No LayerZero endpoint ID for chain ${chainId}`);
    }
    
    return eid;
  }
}

// Export singleton instance
export const crossChainService = new CrossChainService();
