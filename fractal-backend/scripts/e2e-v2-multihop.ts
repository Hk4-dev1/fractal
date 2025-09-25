import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createPublicClient, createWalletClient, encodePacked, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { AddressHex, ensureAddressFromEnv } from './core/address';
import { quote, readNextId, sendSwap, escrowAbi, routerAbi } from './core/contract';
import { ensureAllRpcs } from './core/bootstrap';
import { logStep, time } from './core/log';
import { concatHex } from 'viem';

dotenv.config();

type ChainKey = 'ethereum-sepolia' | 'arbitrum-sepolia' | 'optimism-sepolia' | 'base-sepolia';

function env(name: string){ const v = process.env[name]; if(!v) throw new Error(`Missing env ${name}`); return v; }
function rpcEnv(k: ChainKey): string { return k === 'ethereum-sepolia' ? 'ETH_SEPOLIA_RPC_URL' : k === 'arbitrum-sepolia' ? 'ARB_SEPOLIA_RPC_URL' : k === 'optimism-sepolia' ? 'OP_SEPOLIA_RPC_URL' : 'BASE_SEPOLIA_RPC_URL'; }
function routerEnv(k: ChainKey): string { return k === 'ethereum-sepolia' ? 'ROUTERV2_ETH_SEPOLIA' : k === 'arbitrum-sepolia' ? 'ROUTERV2_ARB_SEPOLIA' : k === 'optimism-sepolia' ? 'ROUTERV2_OP_SEPOLIA' : 'ROUTERV2_BASE_SEPOLIA'; }
function escrowEnv(k: ChainKey): string { return `ESCROW_${k.toUpperCase().replace(/-/g,'_')}`; }

function buildOptions(gas: bigint = 250_000n): `0x${string}` {
  const TYPE3=3n, WORKER=1n, OPT=1n;
  const gasChunk = gas.toString(16).padStart(32,'0'); // uint128 padded
  const opt = `0x${gasChunk}` as const;
  const optLen = (opt.length-2)/2;
  const size = 1 + optLen;
  const header = `0x${TYPE3.toString(16).padStart(4,'0')}` as const;
  const execChunk = (`0x${WORKER.toString(16).padStart(2,'0')}`+`${size.toString(16).padStart(4,'0')}`+`${OPT.toString(16).padStart(2,'0')}`) as `0x${string}`;
  return concatHex([header, execChunk, opt]);
}

async function sendLeg(pk: string, src: ChainKey, dst: ChainKey){
  const cfgPath = path.join(__dirname,'..','config','layerzero.testnets.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath,'utf-8'));
  const srcRpc = env(rpcEnv(src));
  const dstRpc = env(rpcEnv(dst));
  const account = privateKeyToAccount(pk.startsWith('0x')? pk as AddressHex : (`0x${pk}` as AddressHex));
  const mkChain = (name: string, rpc: string) => ({ id:0, name, network:name, nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18}, rpcUrls:{ default:{ http:[rpc] }, public:{ http:[rpc] } } } as const);
  const srcChain = mkChain(src, srcRpc);
  const dstChain = mkChain(dst, dstRpc);
  const srcWallet = createWalletClient({ account, chain: srcChain, transport: http(srcRpc) });
  const dstWallet = createWalletClient({ account, chain: dstChain, transport: http(dstRpc) });
  const srcPublic = createPublicClient({ chain: srcChain, transport: http(srcRpc) });
  const dstPublic = createPublicClient({ chain: dstChain, transport: http(dstRpc) });
  const me = account.address;
  const dstEscrowAddr = ensureAddressFromEnv(escrowEnv(dst));
  const srcRouterAddr = ensureAddressFromEnv(routerEnv(src));
  const srcEid:number = cfg[src].eid;
  const dstEid:number = cfg[dst].eid;
  const nextId = await readNextId(dstPublic, dstEscrowAddr);
  const amountIn = parseEther('0.002');
  logStep('createOrder:start', { chain: dst, id: nextId.toString(), amountIn: amountIn.toString(), srcEid });
  const txHash1 = await time('createOrder', () => dstWallet.writeContract({ account, address: dstEscrowAddr, abi: escrowAbi, functionName: 'createOrder', args: ['0x0000000000000000000000000000000000000000','0x0000000000000000000000000000000000000000',amountIn,0n, BigInt(srcEid) ], value: amountIn }));
  await dstPublic.waitForTransactionReceipt({ hash: txHash1 });
  logStep('createOrder:confirmed', { tx: txHash1 });
  const payload = encodePacked(['uint256','address','uint256'],[nextId, me, 0n]);
  const options = buildOptions();
  const [nativeFee] = await quote(srcPublic, srcRouterAddr, dstEid, payload, options);
  logStep('quote', { src, dst, nativeFee: nativeFee.toString() });
  const txHash2 = await sendSwap(srcWallet, srcRouterAddr, dstEid, payload, options, nativeFee);
  await srcPublic.waitForTransactionReceipt({ hash: txHash2 });
  logStep('send:confirmed', { tx: txHash2 });
  await new Promise(r=>setTimeout(r,8000));
  const ord:any = await dstPublic.readContract({ address: dstEscrowAddr, abi: escrowAbi, functionName: 'getOrder', args: [nextId] });
  logStep('order:final', { chain: dst, status: ord.status, maker: ord.maker, amountIn: ord.amountIn.toString?.() });
}

async function main(){
  ensureAllRpcs();
  const SRC = (process.env.SRC_CHAIN_KEY || 'optimism-sepolia') as ChainKey;
  const DST = (process.env.DST_CHAIN_KEY || 'arbitrum-sepolia') as ChainKey;
  const HOP = (process.env.HOP_CHAIN_KEY || 'ethereum-sepolia') as ChainKey;
  const pk = env('PRIVATE_KEY');
  logStep('multihop:init', { path:[SRC,HOP,DST] });
  await sendLeg(pk, SRC, HOP);
  await sendLeg(pk, HOP, DST);
  logStep('multihop:complete', { path:[SRC,HOP,DST] });
}

main().catch(e=>{ console.error(e); process.exitCode = 1; });
