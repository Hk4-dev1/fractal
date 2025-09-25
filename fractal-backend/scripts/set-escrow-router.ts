import * as dotenv from 'dotenv';
import { createWalletClient, createPublicClient, http, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { addr, raw } from './core/env';
import { readOwner, setRouter } from './core/contract';
import { ensureBaseRpcEnv } from './core/bootstrap';
import { logStep, time } from './core/log';

dotenv.config();

async function main(){
  const escrow = addr('ESCROW_ADDRESS');
  const newRouter = getAddress(process.env.NEW_ROUTER_ADDRESS || '0xd29B640330aBBc0a9D1376eE4327e463c8F16206');
  const pk = raw('PRIVATE_KEY').replace(/^0x/,'');
  const rpc = raw('ETH_SEPOLIA_RPC_URL');
  ensureBaseRpcEnv();
  const account = privateKeyToAccount(`0x${pk}`);
  const chain = { id:11155111, name:'ethereum-sepolia', network:'ethereum-sepolia', nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18}, rpcUrls:{ default:{ http:[rpc] }, public:{ http:[rpc] } } } as const;
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  const pub = createPublicClient({ chain, transport: http(rpc) });
  const owner = await readOwner(pub, escrow);
  if(owner.toLowerCase() !== account.address.toLowerCase()) throw new Error(`Not owner. Owner=${owner} you=${account.address}`);
  logStep('router:update:start', { escrow, newRouter, owner, signer: account.address });
  const hash = await time('setRouter', () => setRouter(wallet, escrow, newRouter as `0x${string}`));
  await pub.waitForTransactionReceipt({ hash });
  logStep('router:update:confirmed', { tx: hash });
}

main().catch(e=>{ console.error(e); process.exitCode=1; });
