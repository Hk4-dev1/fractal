import { validateKeys } from './env';

// Aggregate required environment variables for common multi-chain operations.
// Extend this list as new scripts demand additional keys.
export const BASE_CHAIN_KEYS = [
  'PRIVATE_KEY',
  'ETH_SEPOLIA_RPC_URL',
  'ARB_SEPOLIA_RPC_URL',
  'OP_SEPOLIA_RPC_URL',
  'BASE_SEPOLIA_RPC_URL'
];

// Escrow / router presence may vary per chain; scripts can pass a filtered subset.
export function ensureBaseRpcEnv(){
  validateKeys(['PRIVATE_KEY']);
}

export function ensureAllRpcs(){
  validateKeys(BASE_CHAIN_KEYS);
}

export function ensureEscrowAndRouter(chainKey: string){
  const k = chainKey.toUpperCase().replace(/-/g,'_');
  validateKeys([`ESCROW_${k}`, `ROUTERV2_${k}`]);
}
