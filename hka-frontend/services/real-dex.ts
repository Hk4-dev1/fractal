// Real Balance and DEX Integration Service
import { ethers, Contract } from 'ethers';

// Debug logging utility gated by VITE_DEBUG_DEX environment variable
// Usage: set VITE_DEBUG_DEX=true in .env (or import.meta.env) to enable verbose logs.
const DEBUG_DEX = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_DEX === 'true';
// Light wrapper so we can strip easily later or swap with a structured logger
const dlog = (...args: unknown[]) => { if (DEBUG_DEX) console.log(...args); };
import { CONTRACTS } from './contracts';
import { getTokenDecimals } from '../src/services/tokenDecimals';
import { walletService } from './wallet';

// ERC20 ABI for balance checking
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

// WETH ABI for wrapping/unwrapping
const WETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 amount) external',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

// AMM ABI (extended with fallback reserve + fee accessor for simplified AMM)
const AMM_ABI = [
  'function swap(address,address,uint256,uint256) external returns (uint256)',
  'function getSwapQuote(address,address,uint256) view returns (tuple(uint256 amountIn, uint256 amountOut, uint256 fee, uint256 priceImpact))',
  'function getReserves() view returns (uint256 ethReserve, uint256 usdcReserve)',
  'function feeBps() view returns (uint256)',
  'function addLiquidity(address,address,uint256,uint256,uint256,uint256) external returns (uint256)',
  'function getPool(address,address) view returns (tuple(address token0, address token1, uint256 reserve0, uint256 reserve1, uint256 totalSupply, uint256 lastUpdateTime, bool exists))',
  'function supportedTokens(address) view returns (bool)',
  'function getAllTokens() view returns (address[] memory)',
  'function swapETHForTokens(address,uint256,uint256) external payable',
  'function swapTokensForETH(address,uint256,uint256,uint256) external',
  'function getETHToTokenQuote(address,uint256) view returns (uint256 amountOut, uint256 fee, uint256 priceImpact)',
  'function getTokenToETHQuote(address,uint256) view returns (uint256 amountOut, uint256 fee, uint256 priceImpact)'
];

export interface TokenBalance {
  symbol: string;
  name: string;
  address: string;
  balance: string;
  formattedBalance: string;
  decimals: number;
  priceUSD?: number;
  valueUSD?: number;
}

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  path: string[];
  priceImpact: number;
  minimumReceived: string;
}

export class RealDEXService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private chainId: number | null = null;

  // Helper function to safely parse units with decimal handling
  private safeParseUnits(value: string, decimals: number): bigint {
    try {
  dlog(`🔧 Parsing: "${value}" with ${decimals} decimals`);
      
      // Clean the value - remove extra whitespace and handle edge cases
      const cleanValue = value.toString().trim();
      
      // Check for too many decimal places
      if (cleanValue.includes('.')) {
        const [whole, decimal] = cleanValue.split('.');
        if (decimal && decimal.length > decimals) {
          // Truncate excessive decimal places
          const truncatedDecimal = decimal.slice(0, decimals);
          const newValue = `${whole}.${truncatedDecimal}`;
          dlog(`🔧 Truncated: "${cleanValue}" → "${newValue}"`);
          return ethers.parseUnits(newValue, decimals);
        }
      }
      
      const result = ethers.parseUnits(cleanValue, decimals);
  dlog(`✅ Parsed: "${cleanValue}" → ${result.toString()}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Parse error for "${value}" with ${decimals} decimals:`, error);
      
      // Fallback: convert to number and back to string to clean formatting
      try {
        const numValue = Number(value);
        if (isNaN(numValue)) throw new Error('Invalid number');
        
        const fallbackValue = numValue.toFixed(decimals);
  dlog(`🔄 Fallback: "${value}" → "${fallbackValue}"`);
        return ethers.parseUnits(fallbackValue, decimals);
      } catch (fallbackError) {
        console.error(`❌ Fallback failed:`, fallbackError);
        throw new Error(`Cannot parse "${value}" with ${decimals} decimals: ${(error as Error).message}`);
      }
    }
  }

  async initialize(forceChainId?: number) {
    try {
      const walletState = walletService.getState();
      
      if (!walletState.isConnected || !walletState.provider || !walletState.signer) {
        throw new Error('Wallet not connected');
      }

      // Use forced chainId if provided, otherwise use wallet state
      const targetChainId = forceChainId || walletState.chainId;
  dlog(`🔄 Initializing DEX service for chain ${targetChainId}... ${forceChainId ? '(forced)' : '(from wallet)'}`);
      
      this.provider = walletState.provider;
      this.signer = walletState.signer;
      this.chainId = targetChainId;
      
  dlog(`✅ DEX service initialized for chain ${this.chainId}`);
    } catch (error) {
      console.error('❌ DEX service initialization failed:', error);
      throw error;
    }
  }

  // Check if service is initialized and ready
  isInitialized(): boolean {
    return this.provider !== null && this.signer !== null && this.chainId !== null;
  }

  // Get real token balances for current chain
  async getTokenBalances(): Promise<TokenBalance[]> {
    if (!this.provider || !this.signer || !this.chainId) {
      throw new Error('Service not initialized');
    }

  dlog(`🔍 Fetching balances for chain ${this.chainId}...`);
    
    const contracts = CONTRACTS[this.chainId as keyof typeof CONTRACTS];
    if (!contracts) {
      console.error(`❌ Unsupported chain ID: ${this.chainId}`);
  dlog('Available chain IDs:', Object.keys(CONTRACTS));
      throw new Error(`Unsupported chain: ${this.chainId}`);
    }

    try {
      const userAddress = await this.signer.getAddress();
      const balances: TokenBalance[] = [];

  dlog(`👤 User address: ${userAddress}`);
  dlog(`📍 Network: ${contracts.name}`);
  dlog(`🔗 Chain ID: ${this.chainId}`);
      
      // Verify provider is connected to correct network
      const providerNetwork = await this.provider.getNetwork();
  dlog(`🌐 Provider network: ${providerNetwork.chainId.toString()}`);
      
      if (Number(providerNetwork.chainId) !== this.chainId) {
        console.warn(`⚠️ Provider chainId (${providerNetwork.chainId}) != service chainId (${this.chainId})`);
        throw new Error(`Provider network mismatch: expected ${this.chainId}, got ${providerNetwork.chainId}`);
      }
      
      // Get ETH balance
  dlog('💰 Fetching ETH balance...');
      const ethBalance = await this.provider.getBalance(userAddress);
      balances.push({
        symbol: 'ETH',
        name: 'Native Ethereum',
        address: '0x0000000000000000000000000000000000000000',
        balance: ethBalance.toString(),
        formattedBalance: ethers.formatEther(ethBalance),
        decimals: 18
      });
  dlog(`✅ ETH balance: ${ethers.formatEther(ethBalance)}`);

      // Get WETH balance (if available)
      if (contracts.weth) {
  dlog('💰 Fetching WETH balance...');
        const wethContract = new Contract(contracts.weth, ERC20_ABI, this.provider);
        const wethBalance = await wethContract.balanceOf(userAddress);
        const wethDecimals = await wethContract.decimals();
        
        balances.push({
          symbol: 'WETH',
          name: 'Wrapped Ethereum',
          address: contracts.weth,
          balance: wethBalance.toString(),
          formattedBalance: ethers.formatUnits(wethBalance, wethDecimals),
          decimals: wethDecimals
        });
  dlog(`✅ WETH balance: ${ethers.formatUnits(wethBalance, wethDecimals)}`);
      }
      // Get TestUSDC balance
  dlog('💰 Fetching TestUSDC balance...');
      const usdcContract = new Contract(contracts.testUSDC, ERC20_ABI, this.provider);
      const usdcBalance = await usdcContract.balanceOf(userAddress);
      const usdcDecimals = await usdcContract.decimals();
      
      balances.push({
        symbol: 'USDC',
        name: 'USD Coin',
        address: contracts.testUSDC,
        balance: usdcBalance.toString(),
        formattedBalance: ethers.formatUnits(usdcBalance, usdcDecimals),
        decimals: usdcDecimals
      });
  dlog(`✅ USDC balance: ${ethers.formatUnits(usdcBalance, usdcDecimals)}`);

      // Get TestETH balance (if different from native ETH)
      if (contracts.testETH !== '0x0000000000000000000000000000000000000000') {
        const testEthContract = new Contract(contracts.testETH, ERC20_ABI, this.provider);
        const testEthBalance = await testEthContract.balanceOf(userAddress);
        const testEthDecimals = await testEthContract.decimals();
        
        balances.push({
          symbol: 'TestETH',
          name: 'Test Ethereum',
          address: contracts.testETH,
          balance: testEthBalance.toString(),
          formattedBalance: ethers.formatUnits(testEthBalance, testEthDecimals),
          decimals: testEthDecimals
        });
      }

  dlog('✅ Fetched real balances:', balances);
      return balances;

    } catch (error) {
      console.error('❌ Error fetching balances:', error);
      throw error;
    }
  }

  // Get swap quote from AMM
  async getSwapQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<SwapQuote> {
    if (!this.provider || !this.chainId) {
      throw new Error('Service not initialized');
    }

    const contracts = CONTRACTS[this.chainId as keyof typeof CONTRACTS];
    if (!contracts) {
      throw new Error(`Unsupported chain: ${this.chainId}`);
    }

    try {
  dlog('🔄 Getting swap quote:', { tokenIn, tokenOut, amountIn });
      
      const ammContract = new Contract(contracts.ammEngine, AMM_ABI, this.provider);
      
      // Determine input decimals dynamically
      let inputDecimals = 18;
      if (tokenIn !== '0x0000000000000000000000000000000000000000') {
        try { inputDecimals = await getTokenDecimals(this.chainId, tokenIn); } catch { inputDecimals = 18; }
      }
      
      const amountInWei = this.safeParseUnits(amountIn, inputDecimals);
      let quoteResult;
      
      // Always convert ETH to WETH for quotes since AMM doesn't have ETH functions working
      let actualTokenIn = tokenIn;
      let actualTokenOut = tokenOut;
      
      // Convert native ETH (0x0000...) to WETH address for AMM quote
      if (tokenIn === '0x0000000000000000000000000000000000000000') {
        actualTokenIn = contracts.weth;
  dlog('🔄 Converting ETH input to WETH for quote:', actualTokenIn);
      }
      
      if (tokenOut === '0x0000000000000000000000000000000000000000') {
        actualTokenOut = contracts.weth;
  dlog('🔄 Converting ETH output to WETH for quote:', actualTokenOut);
      }
      
      let amountOut: string; let priceImpact: number; let outputDecimals = 18;
      try {
  dlog('💎 Attempting primary getSwapQuote path');
        quoteResult = await ammContract.getSwapQuote(actualTokenIn, actualTokenOut, amountInWei);
  dlog('✅ Raw quote result:', quoteResult);
        const rawAmountOut = quoteResult.amountOut || quoteResult[1];
        priceImpact = Number(quoteResult.priceImpact || quoteResult[3]) / 10000;
        if (tokenOut !== '0x0000000000000000000000000000000000000000') {
          try { outputDecimals = await getTokenDecimals(this.chainId, tokenOut); } catch { outputDecimals = 18; }
        }
        amountOut = ethers.formatUnits(rawAmountOut, outputDecimals);
      } catch (primaryErr) {
        console.warn('⚠️ getSwapQuote failed; falling back to reserve simulation', primaryErr);
        // Reserve-based fallback (constant product): supports ETH/WETH <-> USDC
        const [reserves, feeBps] = await Promise.all([
          ammContract.getReserves(),
          ammContract.feeBps().catch(() => 30n)
        ]);
        const rEth: bigint = reserves.ethReserve || reserves[0];
        const rUsdc: bigint = reserves.usdcReserve || reserves[1];
        const isInEth = tokenIn === '0x0000000000000000000000000000000000000000' || tokenIn.toLowerCase() === contracts.weth.toLowerCase();
        const feeDen = 10_000n;
        const netIn = (amountInWei * (feeDen - feeBps)) / feeDen;
        let outWei: bigint;
        if (isInEth) {
          const k = rEth * rUsdc;
          const newEth = rEth + netIn;
            const newUsdc = k / newEth;
          outWei = rUsdc - newUsdc;
          outputDecimals = tokenOut.toLowerCase() === contracts.testUSDC.toLowerCase() ? 6 : 18;
        } else {
          const k = rEth * rUsdc;
          const newUsdc = rUsdc + netIn;
          const newEth = k / newUsdc;
          outWei = rEth - newEth;
          outputDecimals = 18;
        }
        if (outWei < 0n) outWei = 0n;
        amountOut = ethers.formatUnits(outWei, outputDecimals);
        // Improved price impact: mid price vs execution price
        const reserveIn = isInEth ? rEth : rUsdc;
        const reserveOut = isInEth ? rUsdc : rEth;
        if (reserveIn > 0n && reserveOut > 0n && netIn > 0n && outWei > 0n) {
          const mid = Number(reserveOut) / Number(reserveIn);
          const exec = Number(outWei) / Number(netIn);
          if (mid > 0 && exec > 0) {
            priceImpact = ((mid - exec) / mid) * 100;
            if (priceImpact < 0) priceImpact = 0;
          } else {
            priceImpact = 0;
          }
        } else {
          priceImpact = 0;
        }
      }

      const slippageTolerance = 0.005;
      const amountOutNumber = Number(amountOut || '0');
      const minimumReceivedNumber = amountOutNumber * (1 - slippageTolerance);
      const minimumReceived = minimumReceivedNumber.toFixed(outputDecimals === 6 ? 6 : 18);

      const quote = { amountIn, amountOut, path: [tokenIn, tokenOut], priceImpact, minimumReceived };
  dlog('✅ Final quote (possibly fallback):', quote);
      return quote;

    } catch (error) {
      console.error('❌ Error getting swap quote:', error);
      throw error;
    }
  }

  // Execute swap
  async executeSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minimumAmountOut: string
  ): Promise<string> {
    if (!this.signer || !this.chainId) {
      throw new Error('Service not initialized');
    }

    const contracts = CONTRACTS[this.chainId as keyof typeof CONTRACTS];
    if (!contracts) {
      throw new Error(`Unsupported chain: ${this.chainId}`);
    }

    try {
      const userAddress = await this.signer.getAddress();
      const ammContract = new Contract(contracts.ammEngine, AMM_ABI, this.signer);
      
  dlog('🔄 Executing swap...', { tokenIn, tokenOut, amountIn, minimumAmountOut });
      
      // Handle different swap scenarios
      if (tokenIn === '0x0000000000000000000000000000000000000000') {
        // ETH → Token: Wrap ETH to WETH then swap
  dlog('💎 Executing ETH → Token swap via WETH');
        
        const amountInWei = this.safeParseUnits(amountIn, 18);
        
        // Determine output token decimals for minimumOut
        let outputDecimals = 18; // Default for ETH/WETH
        if (tokenOut.toLowerCase() === contracts.testUSDC?.toLowerCase()) {
          outputDecimals = 6;
        }
        const minimumOutWei = this.safeParseUnits(minimumAmountOut, outputDecimals);
        
        // 1. Wrap ETH to WETH
        const wethContract = new Contract(contracts.weth, WETH_ABI, this.signer);
  dlog('🔄 Wrapping ETH to WETH...');
        const wrapTx = await wethContract.deposit({ value: amountInWei });
        await wrapTx.wait();
  dlog('✅ ETH wrapped to WETH');
        
        // 2. Approve WETH for AMM
  dlog('🔄 Approving WETH for swap (exact)...');
        {
          const currentAllowance = await wethContract.allowance(userAddress, contracts.ammEngine).catch(() => 0n);
          if (currentAllowance < amountInWei) {
            if (currentAllowance > 0n) {
              const resetTx = await wethContract.approve(contracts.ammEngine, 0n);
              await resetTx.wait();
            }
            const approveTx = await wethContract.approve(contracts.ammEngine, amountInWei);
            await approveTx.wait();
          }
        }
  dlog('✅ WETH approved (exact)');
        
        // 3. Execute WETH → Token swap
  dlog('🔄 Executing WETH → Token swap...');
        const swapTx = await ammContract.swap(
          contracts.weth,
          tokenOut,
          amountInWei,
          minimumOutWei
        );
        
  dlog('🔄 Swap transaction sent:', swapTx.hash);
        await swapTx.wait();
  dlog('✅ ETH swap completed');
        return swapTx.hash;
        
      } else if (tokenOut === '0x0000000000000000000000000000000000000000') {
        // Token → ETH: Swap to WETH then unwrap
  dlog('💎 Executing Token → ETH swap via WETH');
        
        // 1. Approve token if needed
        const tokenContract = new Contract(tokenIn, ERC20_ABI, this.signer);
        const allowance = await tokenContract.allowance(userAddress, contracts.ammEngine);
        
        // Determine input token decimals
        let inputDecimals = 18; // Default for ETH/WETH
        if (tokenIn.toLowerCase() === contracts.testUSDC?.toLowerCase()) {
          inputDecimals = 6;
        }
        const amountInWei = this.safeParseUnits(amountIn, inputDecimals);
        
        if (allowance < amountInWei) {
          dlog('🔄 Approving token for swap (exact)...');
          if (allowance > 0n) {
            const resetTx = await tokenContract.approve(contracts.ammEngine, 0n);
            await resetTx.wait();
          }
          const approveTx = await tokenContract.approve(contracts.ammEngine, amountInWei);
          await approveTx.wait();
          dlog('✅ Token approved (exact)');
        }
        
        // 2. Execute Token → WETH swap (track exact amountOut via balance delta)
        const minimumOutWei = this.safeParseUnits(minimumAmountOut, 18); // ETH always 18 decimals
        const wethContract = new Contract(contracts.weth, WETH_ABI, this.signer);
        const wethBefore = await wethContract.balanceOf(userAddress);

  dlog('🔄 Executing Token → WETH swap...');
        const swapTx = await ammContract.swap(
          tokenIn,
          contracts.weth,
          amountInWei,
          minimumOutWei
        );
        await swapTx.wait();
  dlog('✅ Token → WETH swap completed');

        const wethAfter = await wethContract.balanceOf(userAddress);
        const outWeth = wethAfter - wethBefore;
        if (outWeth <= 0n) {
          throw new Error('Swap produced zero WETH output');
        }

        // 3. Unwrap only the exact WETH received
  dlog('🔄 Unwrapping WETH to ETH (exact):', outWeth.toString());
        const unwrapTx = await wethContract.withdraw(outWeth);
        await unwrapTx.wait();
  dlog('✅ WETH unwrapped to ETH');
        
        return swapTx.hash;
        
      } else {
        // Token → Token: Use regular swap
  dlog('🔄 Executing Token → Token swap');
        
        // Check if token approval is needed
        const tokenContract = new Contract(tokenIn, ERC20_ABI, this.signer);
        const allowance = await tokenContract.allowance(userAddress, contracts.ammEngine);
        const amountInWei = ethers.parseUnits(amountIn, 18);
        
        if (allowance < amountInWei) {
          dlog('🔄 Approving token spend...');
          const approveTx = await tokenContract.approve(contracts.ammEngine, amountInWei);
          await approveTx.wait();
          dlog('✅ Token approved');
        }

        const swapTx = await ammContract.swap(
          tokenIn,
          tokenOut,
          amountInWei,
          ethers.parseUnits(minimumAmountOut, 18)
        );

  dlog('🔄 Swap transaction sent:', swapTx.hash);
        await swapTx.wait();
  dlog('✅ Swap completed');
        return swapTx.hash;
      }

    } catch (error) {
      console.error('❌ Error executing swap:', error);
      throw error;
    }
  }

  // Check if token needs approval
  async checkTokenApproval(tokenAddress: string, spenderAddress: string, amount: string): Promise<boolean> {
    if (!this.signer || tokenAddress === '0x0000000000000000000000000000000000000000') {
      return true; // ETH doesn't need approval
    }

    try {
      const userAddress = await this.signer.getAddress();
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.signer);
      const allowance = await tokenContract.allowance(userAddress, spenderAddress);
      const amountWei = ethers.parseUnits(amount, 18);
      
      return allowance >= amountWei;
    } catch (error) {
      console.error('❌ Error checking approval:', error);
      return false;
    }
  }

  // Get supported tokens for current chain
  getSupportedTokens(): Array<{symbol: string, name: string, address: string}> {
    if (!this.chainId) return [];

    const contracts = CONTRACTS[this.chainId as keyof typeof CONTRACTS];
    if (!contracts) return [];

    return [
      { symbol: 'ETH', name: 'Native Ethereum', address: '0x0000000000000000000000000000000000000000' }, // Native ETH
  { symbol: 'WETH', name: 'Wrapped Ethereum', address: contracts.weth || '0x0000000000000000000000000000000000000000' },
  { symbol: 'USDC', name: 'USD Coin', address: contracts.testUSDC }
    ];
  }

  // Get current chain info
  getCurrentChainInfo() {
    if (!this.chainId) return null;
    
    const contracts = CONTRACTS[this.chainId as keyof typeof CONTRACTS];
    return contracts || null;
  }

  // Get current chain ID
  getCurrentChainId(): number | null {
    return this.chainId;
  }
}

// Export singleton instance
export const realDEXService = new RealDEXService();
