import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

type ChainKey = "ethereum-sepolia" | "arbitrum-sepolia" | "optimism-sepolia" | "base-sepolia";

function ensure(name: string): string { const v = process.env[name]; if (!v || v.trim()==="") throw new Error(`Missing env ${name}`); return v.trim(); }
function rpcEnv(k: ChainKey): string { return k === "ethereum-sepolia" ? "ETH_SEPOLIA_RPC_URL" : k === "arbitrum-sepolia" ? "ARB_SEPOLIA_RPC_URL" : k === "optimism-sepolia" ? "OP_SEPOLIA_RPC_URL" : "BASE_SEPOLIA_RPC_URL"; }
function routerEnv(k: ChainKey): string { return k === "ethereum-sepolia" ? "ROUTERV2_ETH_SEPOLIA" : k === "arbitrum-sepolia" ? "ROUTERV2_ARB_SEPOLIA" : k === "optimism-sepolia" ? "ROUTERV2_OP_SEPOLIA" : "ROUTERV2_BASE_SEPOLIA"; }
function escrowEnv(k: ChainKey): string { return `ESCROW_${k.toUpperCase().replace(/-/g,"_")}`; }

function buildOptions(gas: bigint = 250_000n): string {
  const TYPE3 = 3n, WORKER_EXECUTOR_ID = 1n, OPTTYPE_LZRECEIVE = 1n;
  const opt = ethers.solidityPacked(["uint128"],[gas]);
  const optBytes = ethers.getBytes(opt);
  const size = 1 + optBytes.length;
  const header = ethers.getBytes(ethers.solidityPacked(["uint16"],[TYPE3]));
  const execChunk = ethers.getBytes(ethers.solidityPacked(["uint8","uint16","uint8"],[WORKER_EXECUTOR_ID,size,OPTTYPE_LZRECEIVE]));
  return ethers.hexlify(ethers.concat([header, execChunk, optBytes]));
}

async function sendLeg(pk: string, src: ChainKey, dst: ChainKey) {
  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const srcRpc = ensure(rpcEnv(src));
  const dstRpc = ensure(rpcEnv(dst));
  const srcProvider = new ethers.JsonRpcProvider(srcRpc);
  const dstProvider = new ethers.JsonRpcProvider(dstRpc);
  const srcWallet = new ethers.Wallet(pk, srcProvider);
  const dstWallet = new ethers.Wallet(pk, dstProvider);
  const me = await srcWallet.getAddress();

  const dstEscrowAddr = ensure(escrowEnv(dst));
  const srcRouterAddr = ensure(routerEnv(src));

  const escrowAbi = [
    "function nextOrderId() view returns (uint256)",
    "function createOrder(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid) payable returns (uint256)",
    "function getOrder(uint256) view returns (tuple(address maker,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid,uint256 createdAt,uint8 status))",
  ];
  const routerAbi = [
    "function quote(uint32,bytes,bytes) view returns (uint256 nativeFee, uint256 lzTokenFee)",
    "function sendSwapMessage(uint32,bytes,bytes) payable",
  ];
  const dstEscrow = new ethers.Contract(dstEscrowAddr, escrowAbi, dstWallet);
  const srcRouter = new ethers.Contract(srcRouterAddr, routerAbi, srcWallet);

  const srcEid: number = cfg[src].eid;
  const dstEid: number = cfg[dst].eid;

  const nextId: bigint = await dstEscrow.nextOrderId();
  const amountIn = ethers.parseEther("0.002");
  console.log(`Creating order on ${dst}`, { id: nextId.toString(), amountIn: amountIn.toString(), srcEid });
  const tx1 = await dstEscrow.createOrder(ethers.ZeroAddress, ethers.ZeroAddress, amountIn, 0, BigInt(srcEid), { value: amountIn });
  await tx1.wait();
  console.log(`${dst} createOrder tx:`, tx1.hash);

  const payload = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","address","uint256"], [nextId, me, 0]);
  const options = buildOptions();
  const fee = await srcRouter.quote(dstEid, payload, options);
  const nativeFee = (fee.nativeFee ?? fee[0]) as bigint;
  console.log(`${src}→${dst} quote:`, nativeFee.toString());
  const tx2 = await srcRouter.sendSwapMessage(dstEid, payload, options, { value: nativeFee });
  await tx2.wait();
  console.log(`${src} send tx:`, tx2.hash);

  await new Promise((r)=>setTimeout(r, 8000));
  const ord = await dstEscrow.getOrder(nextId);
  console.log(`${dst} order after:`, { status: ord.status, maker: ord.maker, amountIn: ord.amountIn.toString() });
}

async function main() {
  const SRC = (process.env.SRC_CHAIN_KEY || "optimism-sepolia") as ChainKey;
  const DST = (process.env.DST_CHAIN_KEY || "arbitrum-sepolia") as ChainKey;
  const HOP = (process.env.HOP_CHAIN_KEY || "ethereum-sepolia") as ChainKey;
  const pk = ensure("PRIVATE_KEY");

  console.log(`Multihop: ${SRC} -> ${HOP} -> ${DST}`);
  await sendLeg(pk, SRC, HOP);
  await sendLeg(pk, HOP, DST);
  console.log("Multihop complete");
}

main().catch((e)=>{ console.error(e); process.exitCode = 1; });
