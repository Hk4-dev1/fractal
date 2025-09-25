import * as dotenv from 'dotenv';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { addr, raw } from './core/env';
import { readOwner, readRouter } from './core/contract';
import { ensureBaseRpcEnv } from './core/bootstrap';
import { logStep } from './core/log';

dotenv.config();

async function main(){
  const escrow = addr('ESCROW_ADDRESS');
  const pk = raw('PRIVATE_KEY').replace(/^0x/,'');
  const rpc = raw('ETH_SEPOLIA_RPC_URL');
  ensureBaseRpcEnv();
  const account = privateKeyToAccount(`0x${pk}`);
  const chain = { id:11155111, name:'ethereum-sepolia', network:'ethereum-sepolia', nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18}, rpcUrls:{ default:{ http:[rpc] }, public:{ http:[rpc] } } } as const;
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  const pub = createPublicClient({ chain, transport: http(rpc) });
  const owner = await readOwner(pub, escrow);
  const router = await readRouter(pub, escrow);
  logStep('escrow:info', { signer: account.address, owner, router });
}

main().catch(e=>{ console.error(e); process.exitCode=1; });
