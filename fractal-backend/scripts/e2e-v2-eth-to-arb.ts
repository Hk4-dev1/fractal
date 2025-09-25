import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createWalletClient, createPublicClient, http, parseAbi, encodePacked, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { buildOptions } from './core/options';
import { addr, raw } from './core/env';
import { routerAbi, escrowAbi } from './core/contract';
import { ensureAllRpcs } from './core/bootstrap';
import { logStep, time } from './core/log';

dotenv.config();

function ensure(name: string): string { return raw(name); }

function buildChain(id:number, name:string, rpc:string){
  return { id, name, network: name, nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18}, rpcUrls:{ default:{ http:[rpc] }, public:{ http:[rpc] } } } as const;
}


async function main(){
  const pk = ensure('PRIVATE_KEY').replace(/^0x/,'');
  const ETH_RPC = ensure('ETH_SEPOLIA_RPC_URL');
  const ARB_RPC = ensure('ARB_SEPOLIA_RPC_URL');
  const ROUTER_ETH = addr('ROUTERV2_ETH_SEPOLIA');
  const ESCROW_ARB = addr('ESCROW_ADDRESS');
  ensureAllRpcs();

  const cfgPath = path.join(__dirname,'..','config','layerzero.testnets.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath,'utf-8'));
  const EID_ETH:number = cfg['ethereum-sepolia'].eid;
  const EID_ARB:number = cfg['arbitrum-sepolia'].eid;

  const account = privateKeyToAccount(`0x${pk}`);
  const ethChain = buildChain(11155111,'ethereum-sepolia',ETH_RPC);
  const arbChain = buildChain(421614,'arbitrum-sepolia',ARB_RPC);
  const ethWallet = createWalletClient({ account, chain: ethChain, transport: http(ETH_RPC) });
  const arbWallet = createWalletClient({ account, chain: arbChain, transport: http(ARB_RPC) });
  const ethPublic = createPublicClient({ chain: ethChain, transport: http(ETH_RPC) });
  const arbPublic = createPublicClient({ chain: arbChain, transport: http(ARB_RPC) });
  logStep('init', { signer: account.address });

  // ABIs now imported from shared contract module

  const nextId = await arbPublic.readContract({ address: ESCROW_ARB, abi: escrowAbi, functionName: 'nextOrderId', args: [] }) as bigint;
  const amountIn = parseEther('0.002');
  logStep('createOrder:start', { chain: 'arbitrum-sepolia', id: nextId.toString(), amountIn: amountIn.toString() });
  const txHash1 = await time('createOrder', () => arbWallet.writeContract({ account, address: ESCROW_ARB, abi: escrowAbi, functionName: 'createOrder', args: ['0x0000000000000000000000000000000000000000','0x0000000000000000000000000000000000000000',amountIn,0n, BigInt(EID_ETH) ], value: amountIn }));
  await arbPublic.waitForTransactionReceipt({ hash: txHash1 });
  logStep('createOrder:confirmed', { tx: txHash1 });

  const payload = encodePacked(['uint256','address','uint256'],[nextId, account.address, 0n]);
  const options = buildOptions(250_000n);
  const [nativeFee, lzTokenFee] = await time('quote', () => ethPublic.readContract({ address: ROUTER_ETH, abi: routerAbi, functionName: 'quote', args: [EID_ARB, payload, options] }));
  logStep('quote', { nativeFee: nativeFee.toString(), lzTokenFee: lzTokenFee.toString() });

  logStep('send:start', { src: 'ethereum-sepolia', dst: 'arbitrum-sepolia' });
  const txHash2 = await time('sendSwapMessage', () => ethWallet.writeContract({ account, address: ROUTER_ETH, abi: routerAbi, functionName: 'sendSwapMessage', args: [EID_ARB, payload, options], value: nativeFee }));
  await ethPublic.waitForTransactionReceipt({ hash: txHash2 });
  logStep('send:confirmed', { tx: txHash2 });

  logStep('awaitDelivery', { delayMs: 8000 });
  await new Promise(r=>setTimeout(r,8000));
  const ord: any = await arbPublic.readContract({ address: ESCROW_ARB as `0x${string}`, abi: escrowAbi, functionName: 'getOrder', args: [nextId] });
  logStep('order:final', { status: ord.status, maker: ord.maker, amountIn: ord.amountIn.toString?.() });
  logStep('complete');
}

main().catch(e=>{ console.error(e); process.exitCode=1; });
