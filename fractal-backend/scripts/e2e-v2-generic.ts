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

type ChainKey = "ethereum-sepolia" | "arbitrum-sepolia" | "optimism-sepolia" | "base-sepolia";

function ensure(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env ${name}`);
  return v.trim();
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function toRouterEnv(chainKey: ChainKey): string {
  switch (chainKey) {
    case "ethereum-sepolia": return "ROUTERV2_ETH_SEPOLIA";
    case "arbitrum-sepolia": return "ROUTERV2_ARB_SEPOLIA";
    case "optimism-sepolia": return "ROUTERV2_OP_SEPOLIA";
    case "base-sepolia": return "ROUTERV2_BASE_SEPOLIA";
  }
}

function toEscrowEnv(chainKey: ChainKey): string {
  return `ESCROW_${chainKey.toUpperCase().replace(/-/g, "_")}`;
}

// Options now centralized in core/options

async function main() {
  // Inputs via env or args
  const args = process.argv.slice(2);
  const SRC: ChainKey = (process.env.SRC_CHAIN_KEY || args[0]) as ChainKey;
  const DST: ChainKey = (process.env.DST_CHAIN_KEY || args[1]) as ChainKey;
  if (!SRC || !DST) throw new Error("Provide SRC_CHAIN_KEY and DST_CHAIN_KEY (env or args)");

  const pk = ensure("PRIVATE_KEY").replace(/^0x/, "");
  ensureAllRpcs();

  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const srcEid: number = cfg[SRC].eid;
  const dstEid: number = cfg[DST].eid;

  // Providers & Signers
  const srcRpc = ensure(toRpcEnv(SRC));
  const dstRpc = ensure(toRpcEnv(DST));
  const account = privateKeyToAccount(`0x${pk}`);
  const srcChain = { id: 0, name: SRC, network: SRC, nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18}, rpcUrls:{ default:{ http:[srcRpc] }, public:{ http:[srcRpc] } } } as const;
  const dstChain = { id: 0, name: DST, network: DST, nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18}, rpcUrls:{ default:{ http:[dstRpc] }, public:{ http:[dstRpc] } } } as const;
  const srcWallet = createWalletClient({ account, chain: srcChain, transport: http(srcRpc) });
  const dstWallet = createWalletClient({ account, chain: dstChain, transport: http(dstRpc) });
  const srcPublic = createPublicClient({ chain: srcChain, transport: http(srcRpc) });
  const dstPublic = createPublicClient({ chain: dstChain, transport: http(dstRpc) });
  const me = account.address;
  logStep('init', { src: SRC, dst: DST, signer: me });

  // Contracts: DST escrow, SRC router
  const dstEscrowAddr = addr(toEscrowEnv(DST));
  const srcRouterAddr = addr(toRouterEnv(SRC));

  const escrowParsed = escrowAbi;
  const routerParsed = routerAbi;

  // 1) Create order on DST (srcEid embedded)
  const nextId = await dstPublic.readContract({ address: dstEscrowAddr, abi: escrowParsed, functionName: 'nextOrderId', args: [] }) as bigint;
  const amountIn = parseEther("0.002");
  logStep('createOrder:start', { chain: DST, id: nextId.toString(), amountIn: amountIn.toString(), srcEid });
  const txHash1 = await time('createOrder', () => dstWallet.writeContract({ account, address: dstEscrowAddr, abi: escrowParsed, functionName: 'createOrder', args: ['0x0000000000000000000000000000000000000000','0x0000000000000000000000000000000000000000',amountIn,0n, BigInt(cfg[SRC].eid) ], value: amountIn }));
  await dstPublic.waitForTransactionReceipt({ hash: txHash1 });
  logStep('createOrder:confirmed', { tx: txHash1 });

  // 2) Build payload and options
  const payload = encodePacked(['uint256','address','uint256'],[nextId, me, 0n]);
  const options = buildOptions(250_000n);

  // 3) Quote and send from SRC to DST (with multihop fallback)
  try {
    const [nativeFee] = await time('quote', () => srcPublic.readContract({ address: srcRouterAddr, abi: routerParsed, functionName: 'quote', args: [dstEid, payload, options] }) as Promise<[bigint,bigint]>);
    logStep('quote', { nativeFee: nativeFee.toString() });
    const txHash2 = await time('sendSwapMessage', () => srcWallet.writeContract({ account, address: srcRouterAddr, abi: routerParsed, functionName: 'sendSwapMessage', args: [dstEid, payload, options], value: nativeFee }));
    await srcPublic.waitForTransactionReceipt({ hash: txHash2 });
    logStep('send:confirmed', { tx: txHash2 });
  } catch (e: any) {
    const msg = (e?.message || e?.toString?.() || "").toLowerCase();
  logStep('route:fallback', { reason: msg.slice(0,160) });
    const HOP = (process.env.HOP_CHAIN_KEY || "ethereum-sepolia") as ChainKey;
    await runMultihop(pk, SRC, HOP, DST);
    return;
  }

  // 4) Check updated order on DST
  await new Promise((r) => setTimeout(r, 8000));
  const ord: any = await dstPublic.readContract({ address: dstEscrowAddr, abi: escrowParsed, functionName: 'getOrder', args: [nextId] });
  logStep('order:final', { status: ord.status, maker: ord.maker, amountIn: ord.amountIn.toString() });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

// ---- Multihop helpers ----
async function runMultihop(pk: string, SRC: ChainKey, HOP: ChainKey, DST: ChainKey) {
  logStep('multihop', { path: [SRC,HOP,DST] });
  await sendLeg(pk, SRC, HOP);
  await sendLeg(pk, HOP, DST);
  logStep('multihop:complete', { path: [SRC,HOP,DST] });
}

function toRpcEnv(k: ChainKey): string {
  switch (k) {
    case "ethereum-sepolia": return "ETH_SEPOLIA_RPC_URL";
    case "arbitrum-sepolia": return "ARB_SEPOLIA_RPC_URL";
    case "optimism-sepolia": return "OP_SEPOLIA_RPC_URL";
    case "base-sepolia": return "BASE_SEPOLIA_RPC_URL";
  }
}

function toRouterEnvVar(k: ChainKey): string {
  switch (k) {
    case "ethereum-sepolia": return "ROUTERV2_ETH_SEPOLIA";
    case "arbitrum-sepolia": return "ROUTERV2_ARB_SEPOLIA";
    case "optimism-sepolia": return "ROUTERV2_OP_SEPOLIA";
    case "base-sepolia": return "ROUTERV2_BASE_SEPOLIA";
  }
}

function toEscrowEnvVar(k: ChainKey): string {
  return `ESCROW_${k.toUpperCase().replace(/-/g, "_")}`;
}

async function sendLeg(pk: string, SRC: ChainKey, DST: ChainKey) {
  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const srcRpc = ensure(toRpcEnv(SRC));
  const dstRpc = ensure(toRpcEnv(DST));
  const account = privateKeyToAccount(pk.startsWith('0x')? pk as `0x${string}`: (`0x${pk}` as `0x${string}`));
  const srcChain = { id:0, name:SRC, network:SRC, nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18}, rpcUrls:{ default:{ http:[srcRpc] }, public:{ http:[srcRpc] } } } as const;
  const dstChain = { id:0, name:DST, network:DST, nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18}, rpcUrls:{ default:{ http:[dstRpc] }, public:{ http:[dstRpc] } } } as const;
  const srcWallet = createWalletClient({ account, chain: srcChain, transport: http(srcRpc) });
  const dstWallet = createWalletClient({ account, chain: dstChain, transport: http(dstRpc) });
  const srcPublic = createPublicClient({ chain: srcChain, transport: http(srcRpc) });
  const dstPublic = createPublicClient({ chain: dstChain, transport: http(dstRpc) });
  const me = account.address;
  const dstEscrowAddr = addr(toEscrowEnvVar(DST));
  const srcRouterAddr = addr(toRouterEnvVar(SRC));
  const escrowParsed = escrowAbi;
  const routerParsed = routerAbi;
  const srcEid:number = cfg[SRC].eid;
  const dstEid:number = cfg[DST].eid;
  const nextId = await dstPublic.readContract({ address: dstEscrowAddr, abi: escrowParsed, functionName: 'nextOrderId', args: [] }) as bigint;
  const amountIn = parseEther('0.002');
  logStep('createOrder:start', { chain: DST, id: nextId.toString(), amountIn: amountIn.toString(), srcEid });
  const txHash1 = await dstWallet.writeContract({ account, address: dstEscrowAddr, abi: escrowParsed, functionName: 'createOrder', args: ['0x0000000000000000000000000000000000000000','0x0000000000000000000000000000000000000000',amountIn,0n, BigInt(srcEid) ], value: amountIn });
  await dstPublic.waitForTransactionReceipt({ hash: txHash1 });
  logStep('createOrder:confirmed', { tx: txHash1 });
  const payload = encodePacked(['uint256','address','uint256'],[nextId, me, 0n]);
  const options = buildOptions(250_000n);
  const [nativeFee] = await srcPublic.readContract({ address: srcRouterAddr, abi: routerParsed, functionName: 'quote', args: [dstEid, payload, options] }) as [bigint, bigint];
  logStep('quote', { src:SRC, dst:DST, nativeFee: nativeFee.toString() });
  const txHash2 = await srcWallet.writeContract({ account, address: srcRouterAddr, abi: routerParsed, functionName: 'sendSwapMessage', args: [dstEid, payload, options], value: nativeFee });
  await srcPublic.waitForTransactionReceipt({ hash: txHash2 });
  logStep('send:confirmed', { tx: txHash2 });
  await new Promise(r=>setTimeout(r,8000));
  const ord:any = await dstPublic.readContract({ address: dstEscrowAddr, abi: escrowParsed, functionName: 'getOrder', args: [nextId] });
  logStep('order:final', { chain: DST, status: ord.status, maker: ord.maker, amountIn: ord.amountIn.toString?.() });
}
