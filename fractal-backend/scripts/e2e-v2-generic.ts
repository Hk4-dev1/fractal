import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

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

// Build LZ v2 Type-3 options with Executor lzReceive gas
function buildLzV2OptionsLzReceiveGas(gas: bigint, value: bigint = 0n): string {
  const TYPE3 = 3n; // uint16
  const WORKER_EXECUTOR_ID = 1n; // uint8
  const OPTTYPE_LZRECEIVE = 1n; // uint8
  const opt = value === 0n
    ? ethers.solidityPacked(["uint128"], [gas])
    : ethers.solidityPacked(["uint128", "uint128"], [gas, value]);
  const optBytes = ethers.getBytes(opt);
  const size = 1 + optBytes.length;
  const header = ethers.getBytes(ethers.solidityPacked(["uint16"], [TYPE3]));
  const execChunk = ethers.getBytes(ethers.solidityPacked(["uint8", "uint16", "uint8"], [WORKER_EXECUTOR_ID, size, OPTTYPE_LZRECEIVE]));
  const full = ethers.concat([header, execChunk, optBytes]);
  return ethers.hexlify(full);
}

async function main() {
  // Inputs via env or args
  const args = process.argv.slice(2);
  const SRC: ChainKey = (process.env.SRC_CHAIN_KEY || args[0]) as ChainKey;
  const DST: ChainKey = (process.env.DST_CHAIN_KEY || args[1]) as ChainKey;
  if (!SRC || !DST) throw new Error("Provide SRC_CHAIN_KEY and DST_CHAIN_KEY (env or args)");

  const pk = ensure("PRIVATE_KEY");

  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const srcEid: number = cfg[SRC].eid;
  const dstEid: number = cfg[DST].eid;

  // Providers & Signers
  const srcRpc = ensure(toRpcEnv(SRC));
  const dstRpc = ensure(toRpcEnv(DST));
  const srcProvider = new ethers.JsonRpcProvider(srcRpc);
  const dstProvider = new ethers.JsonRpcProvider(dstRpc);
  const srcWallet = new ethers.Wallet(pk, srcProvider);
  const dstWallet = new ethers.Wallet(pk, dstProvider);
  const me = await srcWallet.getAddress();
  console.log("SRC→DST:", SRC, "→", DST, "Signer:", me);

  // Contracts: DST escrow, SRC router
  const dstEscrowAddr = ensure(toEscrowEnv(DST));
  const srcRouterAddr = ensure(toRouterEnv(SRC));

  const escrowAbi = [
    "function nextOrderId() view returns (uint256)",
    "function createOrder(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid) payable returns (uint256)",
    "function getOrder(uint256) view returns (tuple(address maker,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid,uint256 createdAt,uint8 status))",
  ];
  const dstEscrow = new ethers.Contract(dstEscrowAddr, escrowAbi, dstWallet);

  const routerAbi = [
    "function quote(uint32,bytes,bytes) view returns (uint256 nativeFee, uint256 lzTokenFee)",
    "function sendSwapMessage(uint32,bytes,bytes) payable",
  ];
  const srcRouter = new ethers.Contract(srcRouterAddr, routerAbi, srcWallet);

  // 1) Create order on DST (srcEid embedded)
  const nextId: bigint = await dstEscrow.nextOrderId();
  const amountIn = ethers.parseEther("0.002");
  console.log("Creating DST order", { id: nextId.toString(), amountIn: amountIn.toString(), srcEid });
  const tx1 = await dstEscrow.createOrder(ethers.ZeroAddress, ethers.ZeroAddress, amountIn, 0, BigInt(cfg[SRC].eid), { value: amountIn });
  await tx1.wait();
  console.log("DST createOrder tx:", tx1.hash);

  // 2) Build payload and options
  const payload = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","address","uint256"], [nextId, me, 0]);
  const options = buildLzV2OptionsLzReceiveGas(250_000n);

  // 3) Quote and send from SRC to DST (with multihop fallback)
  try {
    const fee = await srcRouter.quote(dstEid, payload, options);
    const nativeFee = (fee.nativeFee ?? fee[0]) as bigint;
    console.log("Quote:", nativeFee.toString());
    const tx2 = await srcRouter.sendSwapMessage(dstEid, payload, options, { value: nativeFee });
    await tx2.wait();
    console.log("SRC send tx:", tx2.hash);
  } catch (e: any) {
    const msg = (e?.message || e?.toString?.() || "").toLowerCase();
    console.warn("Direct route failed, switching to multihop fallback...", msg);
    const HOP = (process.env.HOP_CHAIN_KEY || "ethereum-sepolia") as ChainKey;
    await runMultihop(pk, SRC, HOP, DST);
    return;
  }

  // 4) Check updated order on DST
  await new Promise((r) => setTimeout(r, 8000));
  const ord = await dstEscrow.getOrder(nextId);
  console.log("DST order after:", { status: ord.status, maker: ord.maker, amountIn: ord.amountIn.toString() });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });

// ---- Multihop helpers ----
async function runMultihop(pk: string, SRC: ChainKey, HOP: ChainKey, DST: ChainKey) {
  console.log(`Multihop: ${SRC} -> ${HOP} -> ${DST}`);
  await sendLeg(pk, SRC, HOP);
  await sendLeg(pk, HOP, DST);
  console.log("Multihop complete");
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
  const srcProvider = new ethers.JsonRpcProvider(srcRpc);
  const dstProvider = new ethers.JsonRpcProvider(dstRpc);
  const srcWallet = new ethers.Wallet(pk, srcProvider);
  const dstWallet = new ethers.Wallet(pk, dstProvider);
  const me = await srcWallet.getAddress();

  const dstEscrowAddr = ensure(toEscrowEnvVar(DST));
  const srcRouterAddr = ensure(toRouterEnvVar(SRC));

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

  const srcEid: number = cfg[SRC].eid;
  const dstEid: number = cfg[DST].eid;

  const nextId: bigint = await dstEscrow.nextOrderId();
  const amountIn = ethers.parseEther("0.002");
  console.log(`Creating order on ${DST}`, { id: nextId.toString(), amountIn: amountIn.toString(), srcEid });
  const tx1 = await dstEscrow.createOrder(ethers.ZeroAddress, ethers.ZeroAddress, amountIn, 0, BigInt(srcEid), { value: amountIn });
  await tx1.wait();
  console.log(`${DST} createOrder tx:`, tx1.hash);

  const payload = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","address","uint256"], [nextId, me, 0]);
  const options = buildLzV2OptionsLzReceiveGas(250_000n);
  const fee = await srcRouter.quote(dstEid, payload, options);
  const nativeFee = (fee.nativeFee ?? fee[0]) as bigint;
  console.log(`${SRC}→${DST} quote:`, nativeFee.toString());
  const tx2 = await srcRouter.sendSwapMessage(dstEid, payload, options, { value: nativeFee });
  await tx2.wait();
  console.log(`${SRC} send tx:`, tx2.hash);

  await new Promise((r) => setTimeout(r, 8000));
  const ord = await dstEscrow.getOrder(nextId);
  console.log(`${DST} order after:`, { status: ord.status, maker: ord.maker, amountIn: ord.amountIn.toString() });
}
