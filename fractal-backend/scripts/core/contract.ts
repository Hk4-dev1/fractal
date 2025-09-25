import { parseAbi, PublicClient, WalletClient } from 'viem';
import type { AddressHex } from './address';

export const routerAbi = parseAbi([
  'function quote(uint32,bytes,bytes) view returns (uint256 nativeFee, uint256 lzTokenFee)',
  'function sendSwapMessage(uint32,bytes,bytes) payable'
]);

export const escrowAbi = parseAbi([
  'function nextOrderId() view returns (uint256)',
  'function createOrder(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid) payable returns (uint256)',
  'function getOrder(uint256) view returns (tuple(address maker,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid,uint256 createdAt,uint8 status))'
]);

export const escrowMgmtAbi = parseAbi([
  'function owner() view returns (address)',
  'function router() view returns (address)',
  'function escrowFeeBps() view returns (uint256)',
  'function protocolFeeBps() view returns (uint256)',
  'function treasuryEscrow() view returns (address)',
  'function treasuryProtocol() view returns (address)',
  'function setFees(uint256,uint256,address,address)',
  'function setRouter(address)'
]);

// Minimal endpoint inspection ABI (used by debug-endpoint + tooling)
export const endpointInspectAbi = parseAbi([
  'function defaultSendLibrary(uint32) view returns (address)',
  'function getSendLibrary(address,uint32) view returns (address)',
  'function isDefaultSendLibrary(address,uint32) view returns (bool)',
  'function isSupportedEid(uint32) view returns (bool)'
]);

export async function readNextId(client: PublicClient, escrow: AddressHex){
  return await client.readContract({ address: escrow, abi: escrowAbi, functionName: 'nextOrderId', args: [] }) as bigint;
}

export async function quote(client: PublicClient, router: AddressHex, dstEid: number, payload: `0x${string}`, options: `0x${string}`){
  return await client.readContract({ address: router, abi: routerAbi, functionName: 'quote', args: [dstEid, payload, options] }) as [bigint,bigint];
}

export async function sendSwap(wallet: WalletClient, router: AddressHex, dstEid: number, payload: `0x${string}`, options: `0x${string}`, fee: bigint){
  return await wallet.writeContract({ account: wallet.account!, chain: wallet.chain, address: router, abi: routerAbi, functionName: 'sendSwapMessage', args: [dstEid, payload, options], value: fee });
}

// Escrow management helpers
export async function readOwner(client: PublicClient, escrow: AddressHex){
  return await client.readContract({ address: escrow, abi: escrowMgmtAbi, functionName: 'owner' }) as AddressHex;
}
export async function readRouter(client: PublicClient, escrow: AddressHex){
  return await client.readContract({ address: escrow, abi: escrowMgmtAbi, functionName: 'router' }) as AddressHex;
}
export async function readFees(client: PublicClient, escrow: AddressHex){
  const [escrowFee, protocolFee, tEscrow, tProtocol] = await Promise.all([
  client.readContract({ address: escrow, abi: escrowMgmtAbi, functionName: 'escrowFeeBps' }) as Promise<bigint>,
  client.readContract({ address: escrow, abi: escrowMgmtAbi, functionName: 'protocolFeeBps' }) as Promise<bigint>,
  client.readContract({ address: escrow, abi: escrowMgmtAbi, functionName: 'treasuryEscrow' }) as Promise<AddressHex>,
  client.readContract({ address: escrow, abi: escrowMgmtAbi, functionName: 'treasuryProtocol' }) as Promise<AddressHex>,
  ]);
  return { escrowFee, protocolFee, treasuryEscrow: tEscrow, treasuryProtocol: tProtocol };
}
export async function setFees(wallet: WalletClient, escrow: AddressHex, escrowFee: bigint, protocolFee: bigint, treasuryEscrow: AddressHex, treasuryProtocol: AddressHex){
  return await wallet.writeContract({ account: wallet.account!, chain: wallet.chain, address: escrow, abi: escrowMgmtAbi, functionName: 'setFees', args: [escrowFee, protocolFee, treasuryEscrow, treasuryProtocol] });
}
export async function setRouter(wallet: WalletClient, escrow: AddressHex, router: AddressHex){
  return await wallet.writeContract({ account: wallet.account!, chain: wallet.chain, address: escrow, abi: escrowMgmtAbi, functionName: 'setRouter', args: [router] });
}
