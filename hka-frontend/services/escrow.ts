// CrossChainEscrow service for managing escrow-based cross-chain swaps
import { ethers } from 'ethers';
import type { Log } from 'ethers';
import { CONTRACTS } from './contracts';

export interface EscrowOrder {
  orderId: string;
  user: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  dstChainId: number;
  dstRecipient: string;
  deadline: number;
  status: number;
  createdAt: number;
}

export interface CreateOrderParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  dstChainId: number;
  dstRecipient: string;
  deadline: number;
}

export class CrossChainEscrowService {
  private contract: ethers.Contract;

  constructor(chainId: number) {
    const contractAddress = CONTRACTS[chainId as keyof typeof CONTRACTS]?.crossChainEscrow;
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('CrossChainEscrow contract not deployed on this network');
    }

    // Basic ABI for core functions
    const abi = [
      "function createOrder(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint16 dstChainId, address dstRecipient, uint256 deadline) returns (bytes32)",
      "function executeOrder(bytes32 orderId, uint256 actualAmountOut)",
      "function cancelOrder(bytes32 orderId)",
      "function getOrder(bytes32 orderId) view returns (tuple(address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint16 dstChainId, address dstRecipient, uint256 deadline, bytes32 orderId, uint8 status, uint256 createdAt))",
      "function canExecute(bytes32 orderId) view returns (bool)",
      "function supportedTokens(address) view returns (bool)",
      "function escrowFee() view returns (uint256)",
      "function createAndExecuteCrossChainSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint16 dstChainId, address dstRecipient, uint256 deadline) returns (bytes32)",
      "function estimateCrossChainSwapCost(address tokenIn, uint256 amountIn, uint16 dstChainId) view returns (uint256, uint256)"
    ];

    if (typeof window !== 'undefined' && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      this.contract = new ethers.Contract(contractAddress, abi, provider);
    } else {
      throw new Error('Web3 provider not available');
    }
  }

  /**
   * Get contract with signer for transactions
   */
  private async getContractWithSigner(): Promise<ethers.Contract> {
    if (typeof window !== 'undefined' && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      return new ethers.Contract(this.contract.target, this.contract.interface, signer);
    }
    throw new Error('Web3 provider not available');
  }

  /**
   * Create a new escrow order for cross-chain swap
   */
  async createOrder(params: CreateOrderParams): Promise<string> {
    try {
      const contract = await this.getContractWithSigner();
      const { tokenIn, tokenOut, amountIn, amountOut, dstChainId, dstRecipient, deadline } = params;

      // Convert amounts to wei using parseEther (ethers v6)
      const amountInWei = ethers.parseEther(amountIn);
      const amountOutWei = ethers.parseEther(amountOut);

      const tx = await contract.createOrder(
        tokenIn,
        tokenOut,
        amountInWei,
        amountOutWei,
        dstChainId,
        dstRecipient,
        deadline
      );

  const receipt = await tx.wait();

  // Extract orderId from event
  const event = receipt.logs?.find((log: Log) => {
        try {
          const parsed = this.contract.interface.parseLog(log);
          return parsed && parsed.name === 'OrderCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.contract.interface.parseLog(event);
        if (parsed && parsed.args && parsed.args.orderId) {
          return parsed.args.orderId;
        }
      }

      throw new Error('OrderCreated event not found');
    } catch (error) {
      console.error('Error creating escrow order:', error);
      throw error;
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<EscrowOrder> {
    try {
      const order = await this.contract.getOrder(orderId);
      return {
        orderId: order.orderId,
        user: order.user,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: ethers.formatEther(order.amountIn),
        amountOut: ethers.formatEther(order.amountOut),
        dstChainId: order.dstChainId,
        dstRecipient: order.dstRecipient,
        deadline: order.deadline,
        status: order.status,
        createdAt: order.createdAt
      };
    } catch (error) {
      console.error('Error getting order details:', error);
      throw error;
    }
  }

  /**
   * Check if token is supported
   */
  async isTokenSupported(tokenAddress: string): Promise<boolean> {
    try {
      return await this.contract.supportedTokens(tokenAddress);
    } catch (error) {
      console.error('Error checking token support:', error);
      throw error;
    }
  }

  /**
   * Get escrow fee
   */
  async getEscrowFee(): Promise<number> {
    try {
      const fee = await this.contract.escrowFee();
      return Number(fee);
    } catch (error) {
      console.error('Error getting escrow fee:', error);
      throw error;
    }
  }

  /**
   * Execute an escrow order (for authorized parties)
   */
  async executeOrder(orderId: string, actualAmountOut: string): Promise<void> {
    try {
      const contract = await this.getContractWithSigner();
      const actualAmountOutWei = ethers.parseEther(actualAmountOut);
      
      const tx = await contract.executeOrder(orderId, actualAmountOutWei);
      await tx.wait();
    } catch (error) {
      console.error('Error executing escrow order:', error);
      throw error;
    }
  }

  /**
   * Cancel an escrow order
   */
  async cancelOrder(orderId: string): Promise<void> {
    try {
      const contract = await this.getContractWithSigner();
      
      const tx = await contract.cancelOrder(orderId);
      await tx.wait();
    } catch (error) {
      console.error('Error canceling escrow order:', error);
      throw error;
    }
  }

  /**
   * Check if an order can be executed
   */
  async canExecute(orderId: string): Promise<boolean> {
    try {
      return await this.contract.canExecute(orderId);
    } catch (error) {
      console.error('Error checking if order can be executed:', error);
      throw error;
    }
  }

  /**
   * Send order to destination chain (triggers LayerZero messaging)
   */
  async sendOrderCrossChain(orderId: string, dstChainId: number): Promise<void> {
    try {
      const contract = await this.getContractWithSigner();
      
      // Call the contract's send function (this will trigger LayerZero messaging)
      // Note: The contract should have a public function to send orders
      const tx = await contract.sendOrderToDestination(orderId, dstChainId);
      await tx.wait();
    } catch (error) {
      console.error('Error sending order cross-chain:', error);
      throw error;
    }
  }

  /**
   * Execute order on destination chain
   */
  async executeOrderOnDestination(orderId: string, actualAmountOut: string): Promise<void> {
    try {
      const contract = await this.getContractWithSigner();
      
      const tx = await contract.executeOrderOnDestination(orderId, ethers.parseEther(actualAmountOut));
      await tx.wait();
    } catch (error) {
      console.error('Error executing order on destination:', error);
      throw error;
    }
  }

  /**
   * Cancel order across chains
   */
  async cancelOrderCrossChain(orderId: string): Promise<void> {
    try {
      const contract = await this.getContractWithSigner();
      
      const tx = await contract.cancelOrderCrossChain(orderId);
      await tx.wait();
    } catch (error) {
      console.error('Error canceling order cross-chain:', error);
      throw error;
    }
  }

  /**
   * Create and execute cross-chain swap in single transaction
   */
  async createAndExecuteCrossChainSwap(params: CreateOrderParams): Promise<string> {
    try {
      const contract = await this.getContractWithSigner();
      const { tokenIn, tokenOut, amountIn, amountOut, dstChainId, dstRecipient, deadline } = params;

      // Convert amounts to wei using parseEther (ethers v6)
      const amountInWei = ethers.parseEther(amountIn);
      const amountOutWei = ethers.parseEther(amountOut);

      // Estimate LayerZero fee
      const [, lzFee] = await this.estimateTotalCost(tokenIn, amountInWei, dstChainId);

      // Execute the optimized cross-chain swap
      const tx = await contract.createAndExecuteCrossChainSwap(
        tokenIn,
        tokenOut,
        amountInWei,
        amountOutWei,
        dstChainId,
        dstRecipient,
        deadline,
        { value: lzFee } // Pay for LayerZero messaging
      );

  const receipt = await tx.wait();

  // Extract orderId from event
  const event = receipt.logs?.find((log: Log) => {
        try {
          const parsed = this.contract.interface.parseLog(log);
          return parsed && parsed.name === 'OrderCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.contract.interface.parseLog(event);
        if (parsed && parsed.args && parsed.args.orderId) {
          return parsed.args.orderId;
        }
      }

      throw new Error('OrderCreated event not found');
    } catch (error) {
      console.error('Error creating optimized cross-chain swap:', error);
      throw error;
    }
  }

  /**
   * Estimate total cost (escrow fee + LayerZero fee)
   */
  async estimateTotalCost(tokenIn: string, amountIn: bigint, dstChainId: number): Promise<[bigint, bigint]> {
    try {
      const [escrowCost, lzFee] = await this.contract.estimateCrossChainSwapCost(tokenIn, amountIn, dstChainId);
      return [escrowCost, lzFee];
    } catch (error) {
      console.error('Error estimating cost:', error);
      return [0n, 0n];
    }
  }
}

export default CrossChainEscrowService;
