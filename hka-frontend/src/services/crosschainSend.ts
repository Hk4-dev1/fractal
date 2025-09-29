// Dynamic send/cancel module now pure viem + raw EIP-1193 (ethers removed).
import { encodeAbiParameters, encodeFunctionData } from 'viem'
import { buildLzV2OptionsLzReceiveGas } from '../utils/lzOptions'
import { UI_TO_CHAINKEY, ESCROWS, ROUTERS, type ChainKey } from '../config/chains'
import CONTRACTS from '../../services/contracts'
import type { ContractsEntry } from '../../types/contracts'
import { getViemClient } from './providerCache'
import type { Eip1193Provider as Eip1193 } from '../../types/eip1193'

const CHAIN_IDS: Record<ChainKey, number> = {
  'ethereum-sepolia': 11155111,
  'arbitrum-sepolia': 421614,
  'optimism-sepolia': 11155420,
  'base-sepolia': 84532,
}

function getChainId(chainKey: ChainKey) { return CHAIN_IDS[chainKey] }
function getRouterAddress(chainKey: ChainKey): `0x${string}` { return ROUTERS[chainKey] }

function getEid(chainKey: ChainKey): number {
  const chainId = CHAIN_IDS[chainKey]
  const entry = (CONTRACTS as Record<number, Pick<ContractsEntry,'layerZeroEid'>>)[chainId]
  const eid = entry?.layerZeroEid
  if (!eid) throw new Error(`Missing LayerZero EID for ${chainKey}`)
  return eid as number
}

// viem-based execute payload encoder (uint256 id, address to, uint256 minOut)
export function encodeExecutePayload(id: bigint, to: `0x${string}`, minOut: bigint): `0x${string}` {
  return encodeAbiParameters([
    { type: 'uint256' },
    { type: 'address' },
    { type: 'uint256' }
  ], [id, to, minOut]) as `0x${string}`
}

// --- EIP-1193 wallet helpers (no ethers) ---
async function switchWalletTo(chainKey: ChainKey) {
  const chainId = CHAIN_IDS[chainKey]
  const w = window as unknown as { ethereum?: Eip1193 }
  if (!w?.ethereum) throw new Error('Wallet not found')
  try {
    await w.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chainId.toString(16)}` }] })
  } catch (err: unknown) {
    const e = err as { code?: number }
    if (e?.code === 4902) {
  const entry = (CONTRACTS as Record<number, Partial<Pick<ContractsEntry,'name'|'rpc'|'explorer'>>>)[chainId]
      await w.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: `0x${chainId.toString(16)}`, chainName: entry?.name || chainKey, rpcUrls: [entry?.rpc], nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: entry?.explorer ? [entry.explorer] : [] }] })
    } else { throw err }
  }
}
async function getWalletOn(chainKey: ChainKey): Promise<{ account: `0x${string}`; chainId: number; ethereum: Eip1193 }> {
  await switchWalletTo(chainKey)
  const w = window as unknown as { ethereum?: Eip1193 }
  if (!w.ethereum) throw new Error('Wallet not found')
  const [account] = await w.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
  if (!account) throw new Error('No account')
  const hexId = await w.ethereum.request({ method: 'eth_chainId' }) as string
  const chainId = parseInt(hexId, 16)
  const expected = CHAIN_IDS[chainKey]
  if (chainId !== expected) throw new Error(`Wrong network: ${chainId} != ${expected}`)
  return { account: account as `0x${string}`, chainId, ethereum: w.ethereum }
}


export type SendRouteResult = { route: 'direct'; txHash: string; orderId: string }
export type CcDispatchDebug = {
  attempt: number
  phase: 'quote' | 'simulate' | 'send' | 'error' | 'done'
  feeWei: bigint
  optionsGas: bigint
  message?: string
}

// Minimal ABIs (object literals -> cheaper than parseAbi)
const ESCROW_FUNCS = [
  { type: 'function', name: 'nextOrderId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'createOrder', stateMutability: 'payable', inputs: [
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'dstEid', type: 'uint64' },
  ], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'dispatchToDst', stateMutability: 'payable', inputs: [
    { name: 'id', type: 'uint256' },
    { name: 'to', type: 'address' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'options', type: 'bytes' },
  ], outputs: [] },
  { type: 'function', name: 'cancelOrder', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }], outputs: [] },
  // management/views
  { type: 'function', name: 'router', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const
const ERC20_FUNCS = [
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' }
  ], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [
    { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }
  ], outputs: [{ type: 'bool' }] },
] as const
const ROUTER_FUNCS = [
  { type: 'function', name: 'quote', stateMutability: 'view', inputs: [
    { name: 'dstEid', type: 'uint32' },
    { name: 'payload', type: 'bytes' },
    { name: 'options', type: 'bytes' }
  ], outputs: [ { type: 'uint256', name: 'nativeFee' }, { type: 'uint256', name: 'lzTokenFee' } ] }
] as const

const ROUTER_INFO_FUNCS = [
  { type: 'function', name: 'peers', stateMutability: 'view', inputs: [{ name: '', type: 'uint32' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'escrow', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

// Export fragment for testing if needed
export const CREATE_ORDER_FRAGMENT = ESCROW_FUNCS[1]

export async function sendRoute(params: {
  fromUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  toUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'
  fromToken: string
  toToken: string
  amount: bigint
  user?: `0x${string}`
  minOut?: bigint
  debug?: (info: CcDispatchDebug) => void
}): Promise<SendRouteResult> {
  const from = UI_TO_CHAINKEY[params.fromUiKey]
  const to = UI_TO_CHAINKEY[params.toUiKey]
  const ORDER_CREATED_TOPIC0 = '0xd4dd83098743e2cc4e36c6cabd9d5e2d436df189d90a92c943f460d6bf9999d5'
  function tryExtractOrderId(log: { address: string; topics: readonly string[]; data: string }, escrowAddr: string): bigint | null {
    if (log.address.toLowerCase() !== escrowAddr.toLowerCase()) return null
    if (!log.topics || log.topics.length < 2) return null
    if (log.topics[0].toLowerCase() !== ORDER_CREATED_TOPIC0) return null
    // topics[1] = id (uint256) 32-byte hex; convert to bigint
    try { return BigInt(log.topics[1]) } catch { return null }
  }
  function resolveTokenAddress(chainId: number, symbol: string): `0x${string}` | null {
  const entry = (CONTRACTS as Record<number, Partial<Pick<ContractsEntry,'weth'|'testUSDC'|'testETH'>> | undefined>)[chainId]
    if (!entry) return null
    const s = symbol.toUpperCase()
    if (s === 'ETH') return '0x0000000000000000000000000000000000000000'
    if (s === 'WETH') return (entry.weth as `0x${string}`) || null
    if (s === 'USDC') return (entry.testUSDC as `0x${string}`) || null
    if (s === 'TESTETH') return (entry.testETH as `0x${string}`) || null
    return null
  }
  async function preflightWiringChecks(minOut: bigint): Promise<void> {
    const chainId = getChainId(from)
    const publicClient = getViemClient(chainId)
    const escrowAddr = ESCROWS[from]
    const expectedRouter = getRouterAddress(from)
    // 1) Escrow.router must be set and match expected
    const escrowRouter = await publicClient.readContract({ address: escrowAddr, abi: ESCROW_FUNCS, functionName: 'router' }) as `0x${string}`
    if (!escrowRouter || escrowRouter.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      throw new Error(`[WIRING] Escrow.router is not set on ${from}. Expected ${expectedRouter}. Please set it to enable dispatch.`)
    }
    if (escrowRouter.toLowerCase() !== expectedRouter.toLowerCase()) {
      throw new Error(`[WIRING] Escrow.router mismatch on ${from}. Expected ${expectedRouter}, got ${escrowRouter}.`)
    }
    // 2) Router.peers[dstEid] must be configured
    const dstEid = getEid(to)
    const peerB32 = await publicClient.readContract({ address: expectedRouter, abi: ROUTER_INFO_FUNCS, functionName: 'peers', args: [dstEid] }) as `0x${string}`
    if (!peerB32 || /^0x0+$/.test(peerB32)) {
      throw new Error(`[WIRING] Router peer not set for dst eid ${dstEid} (${to}). Please wire peers via backend script.`)
    }
    // 3) Router.escrow should match our escrow
    try {
      const routerEscrow = await publicClient.readContract({ address: expectedRouter, abi: ROUTER_INFO_FUNCS, functionName: 'escrow' }) as `0x${string}`
      if (routerEscrow.toLowerCase() !== escrowAddr.toLowerCase()) {
        throw new Error(`[WIRING] Router.escrow mismatch on ${from}. Expected ${escrowAddr}, got ${routerEscrow}. Router was likely deployed with a different escrow.`)
      }
    } catch {
      // ignore if router ABI doesn't expose escrow (should be public)
    }
    // 4) If same-asset ETH bridging (ETH->ETH), destination escrow must be pre-funded with enough ETH for payout
    const srcSym = (params.fromToken || 'ETH').toUpperCase()
    const dstSym = (params.toToken || 'ETH').toUpperCase()
    if (srcSym === 'ETH' && dstSym === 'ETH') {
      const dstClient = getViemClient(getChainId(to))
      const dstEscrow = ESCROWS[to]
      const bal = await dstClient.getBalance({ address: dstEscrow as `0x${string}` })
      if (bal < minOut) {
        throw new Error(`[LIQUIDITY] Destination escrow on ${to} has insufficient ETH balance (${bal} wei) for payout. Fund ${dstEscrow} with at least ${minOut - bal} wei or reduce amount.`)
      }
    }
  }

  async function createOrderOnEscrow(): Promise<bigint> {
    const { account, ethereum } = await getWalletOn(from)
    const chainId = getChainId(from)
    const escrowAddr = ESCROWS[from]
    const publicClient = getViemClient(chainId)
    const tokenInAddr = resolveTokenAddress(chainId, params.fromToken)
    const tokenOutAddr = resolveTokenAddress(getChainId(to), params.toToken) || '0x0000000000000000000000000000000000000000'
    const minOut = params.minOut ?? 0n
    if (!tokenInAddr) throw new Error(`Unknown token ${params.fromToken} on ${from}`)
    if (tokenInAddr !== '0x0000000000000000000000000000000000000000') {
      const allowance: bigint = await publicClient.readContract({
        address: tokenInAddr as `0x${string}`,
        abi: ERC20_FUNCS,
        functionName: 'allowance',
        args: [account, escrowAddr]
      }) as bigint
      if (allowance < params.amount) {
        const approveData = encodeFunctionData({ abi: ERC20_FUNCS, functionName: 'approve', args: [escrowAddr, params.amount] })
        const approveHash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: account, to: tokenInAddr, data: approveData }] }) as `0x${string}`
        const approveRec = await publicClient.waitForTransactionReceipt({ hash: approveHash })
        if (approveRec.status !== 'success') throw new Error('ERC20 approve failed')
      }
      // Pre-simulate createOrder (ERC20) to catch reverts early
      try {
        await publicClient.simulateContract({
          account,
          address: escrowAddr,
          abi: ESCROW_FUNCS,
          functionName: 'createOrder',
          args: [tokenInAddr, tokenOutAddr, params.amount, minOut, BigInt(getEid(to))]
        })
      } catch (e: unknown) {
        const err = e as { shortMessage?: string; message?: string }
        const msg = err?.shortMessage || err?.message || 'simulation failed'
        throw new Error(`[CREATE] ${msg}`)
      }
      const createData = encodeFunctionData({ abi: ESCROW_FUNCS, functionName: 'createOrder', args: [tokenInAddr, tokenOutAddr, params.amount, minOut, BigInt(getEid(to))] })
      const hash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: account, to: escrowAddr, data: createData }] }) as `0x${string}`
      const rec = await publicClient.waitForTransactionReceipt({ hash })
      if (rec.status !== 'success') throw new Error('createOrder failed')
  for (const lg of rec.logs) { const id = tryExtractOrderId(lg as { address: string; topics: readonly string[]; data: string }, escrowAddr); if (id !== null) return id }
    } else {
      // Pre-simulate createOrder (ETH) to catch reverts early
      try {
        await publicClient.simulateContract({
          account,
          address: escrowAddr,
          abi: ESCROW_FUNCS,
          functionName: 'createOrder',
          args: [tokenInAddr, tokenOutAddr, params.amount, minOut, BigInt(getEid(to))],
          value: params.amount
        })
      } catch (e: unknown) {
        const err = e as { shortMessage?: string; message?: string }
        const msg = err?.shortMessage || err?.message || 'simulation failed'
        throw new Error(`[CREATE-ETH] ${msg}`)
      }
      const createData = encodeFunctionData({ abi: ESCROW_FUNCS, functionName: 'createOrder', args: [tokenInAddr, tokenOutAddr, params.amount, minOut, BigInt(getEid(to))] })
      const hash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: account, to: escrowAddr, data: createData, value: '0x' + params.amount.toString(16) }] }) as `0x${string}`
      const rec = await publicClient.waitForTransactionReceipt({ hash })
      if (rec.status !== 'success') throw new Error('createOrder (ETH) failed')
  for (const lg of rec.logs) { const id = tryExtractOrderId(lg as { address: string; topics: readonly string[]; data: string }, escrowAddr); if (id !== null) return id }
    }
    // Fallback: read nextOrderId and subtract 1
    const nextId: bigint = await publicClient.readContract({ address: escrowAddr, abi: ESCROW_FUNCS, functionName: 'nextOrderId' }) as bigint
    return nextId - 1n
  }
  // Preflight wiring validation to produce actionable errors before sending any value
  await preflightWiringChecks(params.minOut ?? 0n)
  const orderId = await createOrderOnEscrow()
  const { account, ethereum } = await getWalletOn(from)
  const recipient = (params.user as `0x${string}`) || account
  // Start with a conservative dst lzReceive gas to reduce underquote risk; may scale up adaptively
  let optionsGas = 400_000n
  let options = buildLzV2OptionsLzReceiveGas(optionsGas)
  const escrowAddr = ESCROWS[from]
  const publicClient = getViemClient(getChainId(from))
  // Quote native fee via router
  const [nativeFeeInitial] = await publicClient.readContract({
    address: getRouterAddress(from),
    abi: ROUTER_FUNCS,
    functionName: 'quote',
    args: [getEid(to), encodeExecutePayload(orderId, recipient, params.minOut ?? 0n), options as `0x${string}`]
  }) as [bigint, bigint]
  params.debug?.({ attempt: 0, phase: 'quote', feeWei: nativeFeeInitial, optionsGas, message: 'initial quote' })
  const dispatchData = encodeFunctionData({ abi: ESCROW_FUNCS, functionName: 'dispatchToDst', args: [orderId, recipient, params.minOut ?? 0n, options as `0x${string}`] })
  // Helper to simulate dispatch and map common revert reasons to friendly messages
  const simulateDispatchOrThrow = async (fee: bigint, attempt: number) => {
    try {
      params.debug?.({ attempt, phase: 'simulate', feeWei: fee, optionsGas, message: 'simulate dispatch' })
      await publicClient.simulateContract({
        account,
        address: escrowAddr,
        abi: ESCROW_FUNCS,
        functionName: 'dispatchToDst',
        args: [orderId, recipient, params.minOut ?? 0n, options as `0x${string}`],
        value: fee
      })
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      const raw = (err?.shortMessage || err?.message || '').toString()
      params.debug?.({ attempt, phase: 'error', feeWei: fee, optionsGas, message: raw })
      if (/INSUFFICIENT_FEE/i.test(raw)) throw new Error('[DISPATCH] Insufficient LayerZero fee; re-quoting…')
      if (/NO_PEER/i.test(raw)) throw new Error('[WIRING] Router peer not set for destination EID')
      if (/NOT_AUTHORIZED|Unauthorized/i.test(raw)) throw new Error('[DISPATCH] Only maker can dispatch or router not authorized')
      if (/BadStatus|BAD_ORDER_STATE|status/i.test(raw)) throw new Error('[DISPATCH] Order not in Created state')
      // Treat generic "reverted" as likely fee underquote; allow outer loop to re-quote/bump
      if (/reverted/i.test(raw)) throw new Error('[DISPATCH] Insufficient LayerZero fee; re-quoting…')
      throw new Error(`[DISPATCH] ${raw || 'simulation failed'}`)
    }
  }
  // Adaptive growth: re-quote and increase fee until simulation passes or limit reached
  let lastReason = ''
  const maxOuter = 4
  for (let attempt = 0; attempt < maxOuter; attempt++) {
    // Re-quote with current options
    const [freshFee] = await publicClient.readContract({
      address: getRouterAddress(from),
      abi: ROUTER_FUNCS,
      functionName: 'quote',
      args: [getEid(to), encodeExecutePayload(orderId, recipient, params.minOut ?? 0n), options as `0x${string}`]
    }) as [bigint, bigint]
    params.debug?.({ attempt, phase: 'quote', feeWei: freshFee, optionsGas, message: 're-quote before simulate' })

    // Inner growth loop
    let feeCandidate = freshFee + 300_000_000_000_000n // +0.0003 ETH safety
    for (let grow = 0; grow < 6; grow++) {
      try {
        await simulateDispatchOrThrow(feeCandidate, attempt)
        // send if simulation passes
        params.debug?.({ attempt, phase: 'send', feeWei: feeCandidate, optionsGas, message: `sending tx (grow=${grow})` })
        const hash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: account, to: escrowAddr, data: dispatchData, value: '0x' + feeCandidate.toString(16) }] }) as `0x${string}`
        const rec = await publicClient.waitForTransactionReceipt({ hash })
        if (rec.status !== 'success') throw new Error('dispatchToDst failed on-chain')
        params.debug?.({ attempt, phase: 'done', feeWei: feeCandidate, optionsGas, message: 'dispatched' })
        return { route: 'direct', txHash: hash, orderId: orderId.toString() }
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message || ''
        lastReason = msg
        // Increase options gas at certain growth steps to reflect heavier dst execution
        if (grow === 2) {
          optionsGas = 800_000n
          options = buildLzV2OptionsLzReceiveGas(optionsGas)
          params.debug?.({ attempt, phase: 'quote', feeWei: feeCandidate, optionsGas, message: 'scale options gas to 800k' })
          break // re-quote with new options
        }
        if (grow === 4) {
          optionsGas = 1_200_000n
          options = buildLzV2OptionsLzReceiveGas(optionsGas)
          params.debug?.({ attempt, phase: 'quote', feeWei: feeCandidate, optionsGas, message: 'scale options gas to 1.2M' })
          break // re-quote with new options
        }
        // Otherwise, grow the fee multiplicatively (x1.25) with a small absolute bump
        const pct = feeCandidate / 4n // ~25%
        feeCandidate = feeCandidate + pct + 100_000_000_000_000n // +0.0001 ETH
        params.debug?.({ attempt, phase: 'simulate', feeWei: feeCandidate, optionsGas, message: `retry simulate (grow=${grow+1})` })
        continue
      }
    }
  }
  const hint = lastReason ? ` Last error: ${lastReason}` : ''
  throw new Error('[DISPATCH] Failed after multiple attempts. This is often due to underquoted cross-chain fee or insufficient dst gas. Please retry in a few seconds.' + hint)
}

export async function cancelOrder(params: { fromUiKey: 'ethereum' | 'arbitrum' | 'optimism' | 'base'; orderId: bigint }): Promise<string> {
  const from = UI_TO_CHAINKEY[params.fromUiKey]
  const { account, ethereum } = await getWalletOn(from)
  const escrowAddr = ESCROWS[from]
  const publicClient = getViemClient(getChainId(from))
  const cancelData = encodeFunctionData({ abi: ESCROW_FUNCS, functionName: 'cancelOrder', args: [params.orderId] })
  const hash = await ethereum.request({ method: 'eth_sendTransaction', params: [{ from: account, to: escrowAddr, data: cancelData }] }) as `0x${string}`
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}
