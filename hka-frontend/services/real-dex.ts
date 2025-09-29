// Real Balance and DEX Integration Service (migrated off ethers -> viem public client + raw EIP-1193 tx)
import { parseUnits, formatUnits } from '../services/viemAdapter'
import { encodeFunctionData } from 'viem'
import { getViemClient, withRetries } from '../src/services/providerCache'

// Debug logging utility gated by VITE_DEBUG_DEX environment variable
// Usage: set VITE_DEBUG_DEX=true in .env (or import.meta.env) to enable verbose logs.
const DEBUG_DEX = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_DEX === 'true';
// Light wrapper so we can strip easily later or swap with a structured logger
const dlog = (...args: unknown[]) => { if (DEBUG_DEX) console.log(...args); };
import { CONTRACTS } from './contracts'
import { getTokenDecimals } from '../src/services/tokenDecimals'
import { walletService } from './wallet'
import type { Eip1193Provider as Eip1193 } from '../types/eip1193'

// Minimal ABIs as object literals (cheaper to re-use)
const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address', name: 'account' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'spender' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool' }] }
] as const

const WETH_ABI = [
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ type: 'uint256', name: 'amount' }], outputs: [] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address', name: 'account' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address', name: 'spender' }, { type: 'uint256', name: 'amount' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'spender' }], outputs: [{ type: 'uint256' }] }
] as const

const AMM_ABI = [
  { type: 'function', name: 'swap', stateMutability: 'nonpayable', inputs: [
    { type: 'address', name: 'tokenIn' }, { type: 'address', name: 'tokenOut' }, { type: 'uint256', name: 'amountIn' }, { type: 'uint256', name: 'minAmountOut' }
  ], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getSwapQuote', stateMutability: 'view', inputs: [
    { type: 'address', name: 'tokenIn' }, { type: 'address', name: 'tokenOut' }, { type: 'uint256', name: 'amountIn' }
  ], outputs: [
    { type: 'uint256', name: 'amountIn' }, { type: 'uint256', name: 'amountOut' }, { type: 'uint256', name: 'fee' }, { type: 'uint256', name: 'priceImpact' }
  ] },
  { type: 'function', name: 'getReserves', stateMutability: 'view', inputs: [], outputs: [
    { type: 'uint256', name: 'ethReserve' }, { type: 'uint256', name: 'usdcReserve' }
  ] },
  { type: 'function', name: 'feeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256', name: 'feeBps' }] }
] as const

function getEthereum(): Eip1193 {
  const w = window as unknown as { ethereum?: Eip1193 }
  if (!w.ethereum) throw new Error('Wallet provider not found')
  return w.ethereum
}

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
  private chainId: number | null = null
  private account: string | null = null

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
          return parseUnits(newValue, decimals);
        }
      }
      
  const result = parseUnits(cleanValue, decimals);
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
  return parseUnits(fallbackValue, decimals);
      } catch (fallbackError) {
        console.error(`❌ Fallback failed:`, fallbackError);
        throw new Error(`Cannot parse "${value}" with ${decimals} decimals: ${(error as Error).message}`);
      }
    }
  }

  async initialize(forceChainId?: number) {
    try {
      const walletState = walletService.getState()
      if (!walletState.isConnected || !walletState.account || !walletState.chainId) throw new Error('Wallet not connected')
      this.chainId = forceChainId || walletState.chainId
      this.account = walletState.account
      dlog(`✅ DEX service initialized for chain ${this.chainId}`)
    } catch (error) {
      console.error('❌ DEX service initialization failed:', error)
      throw error
    }
  }

  // Check if service is initialized and ready
  isInitialized(): boolean { return this.account !== null && this.chainId !== null }

  // Get real token balances for current chain
  async getTokenBalances(): Promise<TokenBalance[]> {
  if (!this.account || !this.chainId) {
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
  const userAddress = this.account as string
  const client = getViemClient(this.chainId)
  const balances: TokenBalance[] = []

  dlog(`👤 User address: ${userAddress}`);
  dlog(`📍 Network: ${contracts.name}`);
  dlog(`🔗 Chain ID: ${this.chainId}`);
      
      // Verify provider is connected to correct network
  // Network mismatch check handled by wallet state; skipped here
      
      // Get ETH balance
  dlog('💰 Fetching ETH balance...');
  const ethBalance = await client.getBalance({ address: userAddress as `0x${string}` })
      balances.push({
        symbol: 'ETH',
        name: 'Native Ethereum',
        address: '0x0000000000000000000000000000000000000000',
        balance: ethBalance.toString(),
  formattedBalance: formatUnits(ethBalance, 18),
        decimals: 18
      });
  dlog(`✅ ETH balance: ${formatUnits(ethBalance, 18)}`);

      // Get WETH balance (if available)
      if (contracts.weth) {
  dlog('💰 Fetching WETH balance...');
  const wethDecimals = await getTokenDecimals(this.chainId, contracts.weth)
  const wethBalance = await withRetries(() => client.readContract({ address: contracts.weth as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] }) as Promise<bigint>)
        
        balances.push({
          symbol: 'WETH',
          name: 'Wrapped Ethereum',
          address: contracts.weth,
          balance: wethBalance.toString(),
          formattedBalance: formatUnits(wethBalance, wethDecimals),
          decimals: wethDecimals
        });
  dlog(`✅ WETH balance: ${formatUnits(wethBalance, wethDecimals)}`);
      }
      // Get TestUSDC balance
  dlog('💰 Fetching TestUSDC balance...');
  const usdcDecimals = await getTokenDecimals(this.chainId, contracts.testUSDC)
  const usdcBalance = await withRetries(() => client.readContract({ address: contracts.testUSDC as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] }) as Promise<bigint>)
      
      balances.push({
        symbol: 'USDC',
        name: 'USD Coin',
        address: contracts.testUSDC,
        balance: usdcBalance.toString(),
  formattedBalance: formatUnits(usdcBalance, usdcDecimals),
        decimals: usdcDecimals
      });
  dlog(`✅ USDC balance: ${formatUnits(usdcBalance, usdcDecimals)}`);

      // Get TestETH balance (if different from native ETH)
      if (contracts.testETH !== '0x0000000000000000000000000000000000000000') {
  const testEthDecimals = await getTokenDecimals(this.chainId, contracts.testETH)
  const testEthBalance = await withRetries(() => client.readContract({ address: contracts.testETH as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] }) as Promise<bigint>)
        
        balances.push({
          symbol: 'TestETH',
          name: 'Test Ethereum',
          address: contracts.testETH,
          balance: testEthBalance.toString(),
          formattedBalance: formatUnits(testEthBalance, testEthDecimals),
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
  if (!this.chainId || !this.account) {
      throw new Error('Service not initialized');
    }

    const contracts = CONTRACTS[this.chainId as keyof typeof CONTRACTS];
    if (!contracts) {
      throw new Error(`Unsupported chain: ${this.chainId}`);
    }

    try {
  dlog('🔄 Getting swap quote:', { tokenIn, tokenOut, amountIn });
      
  const client = getViemClient(this.chainId)
      
      // Determine input decimals dynamically
      let inputDecimals = 18;
      if (tokenIn !== '0x0000000000000000000000000000000000000000') {
        try { inputDecimals = await getTokenDecimals(this.chainId, tokenIn); } catch { inputDecimals = 18; }
      }
      
      const amountInWei = this.safeParseUnits(amountIn, inputDecimals);
  let quoteResult: { amountIn: bigint; amountOut: bigint; fee: bigint; priceImpact: bigint } | readonly [bigint, bigint, bigint, bigint] | undefined;
      
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
  quoteResult = await withRetries(() => client.readContract({ address: contracts.ammEngine as `0x${string}`, abi: AMM_ABI, functionName: 'getSwapQuote', args: [actualTokenIn as `0x${string}`, actualTokenOut as `0x${string}`, amountInWei] }) as Promise<{ amountIn: bigint; amountOut: bigint; fee: bigint; priceImpact: bigint } | readonly [bigint, bigint, bigint, bigint]>)
  dlog('✅ Raw quote result:', quoteResult);
  const isTuple = Array.isArray(quoteResult)
  const rawAmountOut = isTuple ? (quoteResult as readonly [bigint, bigint, bigint, bigint])[1] : (quoteResult as { amountOut: bigint }).amountOut
  const rawPi = isTuple ? (quoteResult as readonly [bigint, bigint, bigint, bigint])[3] : (quoteResult as { priceImpact: bigint }).priceImpact
  priceImpact = Number(rawPi) / 10000;
        if (tokenOut !== '0x0000000000000000000000000000000000000000') {
          try { outputDecimals = await getTokenDecimals(this.chainId, tokenOut); } catch { outputDecimals = 18; }
        }
  amountOut = formatUnits(rawAmountOut, outputDecimals);
      } catch (primaryErr) {
        console.warn('⚠️ getSwapQuote failed; falling back to reserve simulation', primaryErr);
        // Reserve-based fallback (constant product): supports ETH/WETH <-> USDC
        const [reserves, feeBps] = await Promise.all([
          withRetries(() => client.readContract({ address: contracts.ammEngine as `0x${string}`, abi: AMM_ABI, functionName: 'getReserves' }) as Promise<{ ethReserve: bigint; usdcReserve: bigint } | readonly [bigint, bigint]>),
          client.readContract({ address: contracts.ammEngine as `0x${string}`, abi: AMM_ABI, functionName: 'feeBps' }).catch(() => 30n)
        ])
        const hasStruct = (x: unknown): x is { ethReserve: bigint; usdcReserve: bigint } =>
          typeof x === 'object' && x !== null && 'ethReserve' in x && 'usdcReserve' in x
        const rEth: bigint = Array.isArray(reserves) ? reserves[0] : (hasStruct(reserves) ? reserves.ethReserve : 0n)
        const rUsdc: bigint = Array.isArray(reserves) ? reserves[1] : (hasStruct(reserves) ? reserves.usdcReserve : 0n)
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
  amountOut = formatUnits(outWei, outputDecimals);
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
  if (!this.account || !this.chainId) {
      throw new Error('Service not initialized');
    }

    const contracts = CONTRACTS[this.chainId as keyof typeof CONTRACTS];
    if (!contracts) {
      throw new Error(`Unsupported chain: ${this.chainId}`);
    }

    try {
  const userAddress = this.account as string
  const client = getViemClient(this.chainId)
  const ethereum = getEthereum()
      
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
    const depositData = encodeFunctionData({ abi: WETH_ABI, functionName: 'deposit' })
  dlog('🔄 Wrapping ETH to WETH...');
    const wrapHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: contracts.weth, data: depositData, value: '0x' + amountInWei.toString(16) }] }) as `0x${string}`
    await client.waitForTransactionReceipt({ hash: wrapHash })
  dlog('✅ ETH wrapped to WETH');
        
        // 2. Approve WETH for AMM
  dlog('🔄 Approving WETH for swap (exact)...');
        const currentAllowance: bigint = await client.readContract({ address: contracts.weth as `0x${string}`, abi: WETH_ABI, functionName: 'allowance', args: [userAddress as `0x${string}`, contracts.ammEngine as `0x${string}`] }) as bigint
        if (currentAllowance < amountInWei) {
          if (currentAllowance > 0n) {
            const resetData = encodeFunctionData({ abi: WETH_ABI, functionName: 'approve', args: [contracts.ammEngine as `0x${string}`, 0n] })
            const resetHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: contracts.weth, data: resetData }] }) as `0x${string}`
            await client.waitForTransactionReceipt({ hash: resetHash })
          }
          const approveData = encodeFunctionData({ abi: WETH_ABI, functionName: 'approve', args: [contracts.ammEngine as `0x${string}`, amountInWei] })
          const approveHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: contracts.weth, data: approveData }] }) as `0x${string}`
          await client.waitForTransactionReceipt({ hash: approveHash })
        }
  dlog('✅ WETH approved (exact)');
        
        // 3. Execute WETH → Token swap
  dlog('🔄 Executing WETH → Token swap...');
  const swapData = encodeFunctionData({ abi: AMM_ABI, functionName: 'swap', args: [contracts.weth as `0x${string}`, tokenOut as `0x${string}`, amountInWei, minimumOutWei] })
    const swapHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: contracts.ammEngine, data: swapData }] }) as `0x${string}`
  dlog('🔄 Swap transaction sent:', swapHash);
    await client.waitForTransactionReceipt({ hash: swapHash })
  dlog('✅ ETH swap completed');
    return swapHash;
        
      } else if (tokenOut === '0x0000000000000000000000000000000000000000') {
        // Token → ETH: Swap to WETH then unwrap
  dlog('💎 Executing Token → ETH swap via WETH');
        
        // 1. Approve token if needed
  const allowance: bigint = await client.readContract({ address: tokenIn as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance', args: [userAddress as `0x${string}`, contracts.ammEngine as `0x${string}`] }) as bigint
        
        // Determine input token decimals
        let inputDecimals = 18; // Default for ETH/WETH
        if (tokenIn.toLowerCase() === contracts.testUSDC?.toLowerCase()) {
          inputDecimals = 6;
        }
        const amountInWei = this.safeParseUnits(amountIn, inputDecimals);
        
        if (allowance < amountInWei) {
          dlog('🔄 Approving token for swap (exact)...');
          if (allowance > 0n) {
            const resetData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [contracts.ammEngine as `0x${string}`, 0n] })
            const resetHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: tokenIn, data: resetData }] }) as `0x${string}`
            await client.waitForTransactionReceipt({ hash: resetHash })
          }
          const approveData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [contracts.ammEngine as `0x${string}`, amountInWei] })
          const approveHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: tokenIn, data: approveData }] }) as `0x${string}`
          await client.waitForTransactionReceipt({ hash: approveHash })
          dlog('✅ Token approved (exact)');
        }
        
        // 2. Execute Token → WETH swap (track exact amountOut via balance delta)
        const minimumOutWei = this.safeParseUnits(minimumAmountOut, 18); // ETH always 18 decimals
  const wethBefore: bigint = await client.readContract({ address: contracts.weth as `0x${string}`, abi: WETH_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] }) as bigint

  dlog('🔄 Executing Token → WETH swap...');
  const swapData = encodeFunctionData({ abi: AMM_ABI, functionName: 'swap', args: [tokenIn as `0x${string}`, contracts.weth as `0x${string}`, amountInWei, minimumOutWei] })
  const swapHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: contracts.ammEngine, data: swapData }] }) as `0x${string}`
  await client.waitForTransactionReceipt({ hash: swapHash })
  dlog('✅ Token → WETH swap completed');
  const wethAfter: bigint = await client.readContract({ address: contracts.weth as `0x${string}`, abi: WETH_ABI, functionName: 'balanceOf', args: [userAddress as `0x${string}`] }) as bigint
        const outWeth = wethAfter - wethBefore;
        if (outWeth <= 0n) {
          throw new Error('Swap produced zero WETH output');
        }

        // 3. Unwrap only the exact WETH received
  dlog('🔄 Unwrapping WETH to ETH (exact):', outWeth.toString());
  const withdrawData = encodeFunctionData({ abi: WETH_ABI, functionName: 'withdraw', args: [outWeth] })
  const withdrawHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: contracts.weth, data: withdrawData }] }) as `0x${string}`
  await client.waitForTransactionReceipt({ hash: withdrawHash })
  dlog('✅ WETH unwrapped to ETH');
        
  return swapHash;
        
      } else {
        // Token → Token: Use regular swap
  dlog('🔄 Executing Token → Token swap');
        
        // Check if token approval is needed
  const allowance: bigint = await client.readContract({ address: tokenIn as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance', args: [userAddress as `0x${string}`, contracts.ammEngine as `0x${string}`] }) as bigint
  const amountInWei = parseUnits(amountIn, 18);
        
    if (allowance < amountInWei) {
      dlog('🔄 Approving token spend...');
          const approveData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [contracts.ammEngine as `0x${string}`, amountInWei] })
      const approveHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: tokenIn, data: approveData }] }) as `0x${string}`
      await client.waitForTransactionReceipt({ hash: approveHash })
      dlog('✅ Token approved');
    }

  const swapData = encodeFunctionData({ abi: AMM_ABI, functionName: 'swap', args: [tokenIn as `0x${string}`, tokenOut as `0x${string}`, amountInWei, parseUnits(minimumAmountOut, 18)] })
    const swapHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: userAddress, to: contracts.ammEngine, data: swapData }] }) as `0x${string}`
  dlog('🔄 Swap transaction sent:', swapHash);
    await client.waitForTransactionReceipt({ hash: swapHash })
  dlog('✅ Swap completed');
    return swapHash;
      }

    } catch (error) {
      console.error('❌ Error executing swap:', error);
      throw error;
    }
  }

  // Check if token needs approval
  async checkTokenApproval(tokenAddress: string, spenderAddress: string, amount: string): Promise<boolean> {
  if (!this.account || tokenAddress === '0x0000000000000000000000000000000000000000') {
      return true; // ETH doesn't need approval
    }

    try {
    const userAddress = this.account as string
    const client = getViemClient(this.chainId!)
    const allowance: bigint = await client.readContract({ address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance', args: [userAddress as `0x${string}`, spenderAddress as `0x${string}`] }) as bigint
  const amountWei = parseUnits(amount, 18);
      
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
  getCurrentChainId(): number | null { return this.chainId }
}

// Export singleton instance
export const realDEXService = new RealDEXService();
