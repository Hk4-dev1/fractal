import { ethers, BrowserProvider, Signer, AbiCoder, solidityPacked, getBytes, hexlify, concat, parseUnits, toUtf8Bytes } from 'ethers';
const DEBUG_DEX = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_DEX === 'true';
const dlog = (...args: unknown[]) => { if (DEBUG_DEX) console.log(...args); };
import { CONTRACTS, CROSS_CHAIN_PAIRS } from './contracts';
import { buildSwapPayload, encodePayload, defaultDeadline } from './crosschainPayload';

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

// OrderBook Engine ABI (for futures trading)
const ORDERBOOK_ENGINE_ABI = [
  'function placePerpOrder(address baseToken, address quoteToken, uint256 price, uint256 amount, uint256 leverage, uint256 margin) external returns (uint256)',
  'function deposit(address token, uint256 amount) external',
  'function getBalance(address user, address token) external view returns (uint256)',
  'function getPosition(address user, address baseToken) external view returns (uint256 size, uint256 margin, uint256 entryPrice, bool isLong)',
  'event PerpOrderPlaced(address indexed user, uint256 indexed orderId, address baseToken, address quoteToken, uint256 price, uint256 amount, uint256 leverage)',
  'event PerpOrderExecuted(uint256 indexed orderId, uint256 executionPrice)',
  'event PositionOpened(address indexed user, address indexed baseToken, uint256 size, uint256 margin, uint256 entryPrice, bool isLong)'
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
    }
  }

  // Initialize with wallet provider
  async initialize(provider: BrowserProvider) {
    this.provider = provider;
    this.signer = await provider.getSigner();
    
    // Check if connected to supported network
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    if (!CONTRACTS[chainId as keyof typeof CONTRACTS]) {
      throw new Error(`Unsupported network: ${network.name} (${chainId})`);
    }
    
    return network;
  }

  // Get available cross-chain pairs from current network
  getAvailablePairs(currentChainId: number) {
    return CROSS_CHAIN_PAIRS.filter(pair => pair.from === currentChainId);
  }

  // Create cross-chain futures order payload
  private encodeOrderPayload(order: CrossChainOrder): string {
    const {
      baseToken,
      quoteToken, 
      price,
      amount,
      leverage,
      margin,
      side
    } = order;

    // Convert string values to proper BigNumber format for ABI encoding
    // Use parseUnits for proper conversion
    const priceBN = parseUnits(price.toString(), 0); // Already in wei format
    const amountBN = parseUnits(amount.toString(), 0); // Already in wei format
    const leverageBN = BigInt(leverage); // Leverage is a simple integer
    const marginBN = parseUnits(margin.toString(), 0); // Already in wei format

  dlog('🔍 Encoding order payload:', {
      baseToken,
      quoteToken,
      price: price.toString(),
      amount: amount.toString(),
      leverage,
      margin: margin.toString(),
      side,
      priceBN: priceBN.toString(),
      amountBN: amountBN.toString(),
      leverageBN: leverageBN.toString(),
      marginBN: marginBN.toString()
    });

    // Encode order data using ethers v6 AbiCoder
    const abiCoder = AbiCoder.defaultAbiCoder();
    const orderPayload = abiCoder.encode(
      ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint8'],
      [baseToken, quoteToken, priceBN, amountBN, leverageBN, marginBN, side === 'long' ? 1 : 0]
    );

    // Optional feature-flagged payload extension with minAmountOut/deadline
  const useFeature = typeof import.meta !== 'undefined' && import.meta.env?.VITE_FEATURE_CCPAYLOAD === 'true';
    if (useFeature) {
      // minAmountOut: by default 99% of amount (1% slippage) as placeholder; deadline now+10m
      const minOut = (amountBN * 99n) / 100n;
      const payload = buildSwapPayload({
        minAmountOut: minOut.toString(),
        deadline: defaultDeadline(10),
        extra: { side }
      });
      const encoded = encodePayload(payload);
      const bytes = toUtf8Bytes(encoded);
      // Use type 0x02 for feature-extended message, then append 0x01 + order payload
      const featurePrefix = concat([ getBytes('0x02'), bytes ]);
      dlog('🧩 FEATURE_CCPAYLOAD enabled, prefix bytes length:', bytes.length);
      // Final message: (0x02 + json) + 0x01 + abi(order)
      return hexlify(concat([
        featurePrefix,
        getBytes('0x01'),
        getBytes(orderPayload)
      ]));
    }

    // Default message: 0x01 + orderPayload
    return hexlify(concat([
      getBytes('0x01'),
      getBytes(orderPayload)
    ]));
  }

  // Get quote for cross-chain order
  async getQuote(order: CrossChainOrder): Promise<CrossChainQuote> {
    if (!this.provider || !this.signer) {
      throw new Error('Provider not initialized');
    }

    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);
    const contracts = CONTRACTS[chainId as keyof typeof CONTRACTS];
    
    if (!contracts) {
      throw new Error(`Unsupported source network: ${chainId}`);
    }

    const targetContracts = CONTRACTS[order.toChain as keyof typeof CONTRACTS];
    if (!targetContracts) {
      throw new Error(`Unsupported target network: ${order.toChain}`);
    }

    // Get relay contract
    const relay = new ethers.Contract(
      contracts.layerZeroRelay,
      LAYERZERO_RELAY_ABI,
      this.signer
    );

    // Encode order payload
    const messagePayload = this.encodeOrderPayload(order);

    // Create options for LayerZero using ethers v6 solidityPacked
    const options = solidityPacked(
      ['uint16', 'uint256'],
      [1, 300000] // version 1, 300k gas
    );

    try {
      // Get quote from LayerZero
      const [nativeFee, lzTokenFee] = await relay.quote(
        targetContracts.layerZeroEid,
        messagePayload,
        options,
        false // pay in native token
      );

      return {
        nativeFee: nativeFee.toString(),
        lzTokenFee: lzTokenFee.toString(),
        gasCost: nativeFee.toString() // Total cost in native token
      };

    } catch (error: unknown) {
      console.error('Quote error:', error);
      const msg = (error as { message?: string })?.message || String(error);
      throw new Error(`Failed to get cross-chain quote: ${msg}`);
    }
  }

  // Send cross-chain futures order
  async sendCrossChainOrder(order: CrossChainOrder, quote: CrossChainQuote): Promise<string> {
    if (!this.provider || !this.signer) {
      throw new Error('Provider not initialized');
    }

    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);
    const contracts = CONTRACTS[chainId as keyof typeof CONTRACTS];
    
    if (!contracts) {
      throw new Error(`Unsupported source network: ${chainId}`);
    }

    const targetContracts = CONTRACTS[order.toChain as keyof typeof CONTRACTS];
    if (!targetContracts) {
      throw new Error(`Unsupported target network: ${order.toChain}`);
    }

    // Get relay contract
    const relay = new ethers.Contract(
      contracts.layerZeroRelay,
      LAYERZERO_RELAY_ABI,
      this.signer
    );

    // Encode order payload
    const messagePayload = this.encodeOrderPayload(order);

    // Create options
    const options = solidityPacked(
      ['uint16', 'uint256'],
      [1, 300000] // version 1, 300k gas
    );

    try {
      // Send cross-chain order
      const tx = await relay.sendOrder(
        targetContracts.layerZeroEid,
        messagePayload,
        options,
        {
          value: quote.nativeFee,
          gasLimit: 500000 // Manual gas limit
        }
      );

  dlog('Cross-chain order sent:', {
        txHash: tx.hash,
        from: contracts.name,
        to: targetContracts.name,
        order: order
      });

      return tx.hash;

    } catch (error: unknown) {
      console.error('Send order error:', error);
      const msg = (error as { message?: string })?.message || String(error);
      throw new Error(`Failed to send cross-chain order: ${msg}`);
    }
  }

  // Place local futures order (same chain)
  async placeFuturesOrder(order: Omit<CrossChainOrder, 'fromChain' | 'toChain'>): Promise<string> {
    if (!this.provider || !this.signer) {
      throw new Error('Provider not initialized');
    }

    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);
    const contracts = CONTRACTS[chainId as keyof typeof CONTRACTS];
    
    if (!contracts) {
      throw new Error(`Unsupported network: ${chainId}`);
    }

    // Get OrderBook engine contract
    const orderBook = new ethers.Contract(
      contracts.orderBookEngine,
      ORDERBOOK_ENGINE_ABI,
      this.signer
    );

    try {
      // Place perpetual order directly
      const tx = await orderBook.placePerpOrder(
        order.baseToken,
        order.quoteToken,
        order.price,
        order.amount,
        order.leverage,
        order.margin,
        {
          gasLimit: 300000
        }
      );

  dlog('Local futures order placed:', {
        txHash: tx.hash,
        network: contracts.name,
        order: order
      });

      return tx.hash;

    } catch (error: unknown) {
      console.error('Place order error:', error);
      const msg = (error as { message?: string })?.message || String(error)
      throw new Error(`Failed to place futures order: ${msg}`);
    }
  }

  // Get user position on specific chain
  async getPosition(userAddress: string, baseToken: string, chainId?: number): Promise<{ size: string; margin: string; entryPrice: string; isLong: boolean; chainId: number; chainName: string }> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const network = await this.provider.getNetwork();
    const targetChainId = chainId || Number(network.chainId);
    const contracts = CONTRACTS[targetChainId as keyof typeof CONTRACTS];
    
    if (!contracts) {
      throw new Error(`Unsupported network: ${targetChainId}`);
    }

    // Get OrderBook engine contract (read-only)
    const orderBook = new ethers.Contract(
      contracts.orderBookEngine,
      ORDERBOOK_ENGINE_ABI,
      this.provider
    );

    try {
      const [size, margin, entryPrice, isLong] = await orderBook.getPosition(userAddress, baseToken);
      
      return {
        size: size.toString(),
        margin: margin.toString(),
        entryPrice: entryPrice.toString(),
        isLong,
        chainId: targetChainId,
        chainName: contracts.name
      };

    } catch (error: unknown) {
      console.error('Get position error:', error);
      const msg = (error as { message?: string })?.message || String(error);
      throw new Error(`Failed to get position: ${msg}`);
    }
  }

  // Check if cross-chain pair is supported
  isValidPair(fromChain: number, toChain: number): boolean {
    return CROSS_CHAIN_PAIRS.some(pair => 
      pair.from === fromChain && pair.to === toChain
    );
  }

  // Get contract addresses for specific chain
  getContractAddresses(chainId: number) {
    return CONTRACTS[chainId as keyof typeof CONTRACTS];
  }
}

// Export singleton instance
export const crossChainService = new CrossChainService();
