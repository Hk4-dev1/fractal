import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

function ensure(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env ${name}`);
  return v.trim();
}

// Build LayerZero v2 Type-3 options with a single Executor LZReceive gas option
// Encoding matches OptionsBuilder.newOptions().addExecutorLzReceiveOption(gas, 0)
function buildLzV2OptionsLzReceiveGas(gas: bigint, value: bigint = 0n): string {
  // constants
  const TYPE3 = 3n; // uint16
  const WORKER_EXECUTOR_ID = 1n; // uint8
  const OPTTYPE_LZRECEIVE = 1n; // uint8

  // option bytes: abi.encodePacked(uint128 gas [, uint128 value])
  const opt =
    value === 0n
      ? ethers.solidityPacked(["uint128"], [gas])
      : ethers.solidityPacked(["uint128", "uint128"], [gas, value]);
  const optBytes = ethers.getBytes(opt);
  const size = 1 + optBytes.length; // optionType (1 byte) + option length

  const header = ethers.getBytes(ethers.solidityPacked(["uint16"], [TYPE3]));
  const execChunk = ethers.getBytes(
    ethers.solidityPacked(["uint8", "uint16", "uint8"], [WORKER_EXECUTOR_ID, size, OPTTYPE_LZRECEIVE])
  );

  const full = ethers.concat([header, execChunk, optBytes]);
  return ethers.hexlify(full);
}

async function main() {
  const pk = ensure("PRIVATE_KEY");
  const ETH_RPC = ensure("ETH_SEPOLIA_RPC_URL");
  const ARB_RPC = ensure("ARB_SEPOLIA_RPC_URL");
  const ROUTER_ETH = ensure("ROUTERV2_ETH_SEPOLIA");
  const ESCROW_ARB = ensure("ESCROW_ADDRESS"); // ensure this points to ARB escrow

  const cfgPath = path.join(__dirname, "..", "config", "layerzero.testnets.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const EID_ETH: number = cfg["ethereum-sepolia"].eid;
  const EID_ARB: number = cfg["arbitrum-sepolia"].eid;

  // Providers & Signers
  const ethProvider = new ethers.JsonRpcProvider(ETH_RPC);
  const arbProvider = new ethers.JsonRpcProvider(ARB_RPC);
  const ethWallet = new ethers.Wallet(pk, ethProvider);
  const arbWallet = new ethers.Wallet(pk, arbProvider);
  const me = await ethWallet.getAddress();
  console.log("Signer:", me);

  // Escrow (ARB)
  const escrowAbi = [
    "function nextOrderId() view returns (uint256)",
    "function createOrder(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid) payable returns (uint256)",
    "function getOrder(uint256) view returns (tuple(address maker,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid,uint256 createdAt,uint8 status))",
  ];
  const arbEscrow = new ethers.Contract(ESCROW_ARB, escrowAbi, arbWallet);

  // Step 1: Create order on ARB
  const nextId: bigint = await arbEscrow.nextOrderId();
  const amountIn = ethers.parseEther("0.002");
  console.log("Creating ARB order", { id: nextId.toString(), amountIn: amountIn.toString() });
  const tx1 = await arbEscrow.createOrder(ethers.ZeroAddress, ethers.ZeroAddress, amountIn, 0, BigInt(EID_ETH), { value: amountIn });
  const rc1 = await tx1.wait();
  console.log("ARB createOrder tx:", rc1?.hash);

  // Step 2: Build payload for ARB order release
  const payload = ethers.AbiCoder.defaultAbiCoder().encode(["uint256","address","uint256"], [nextId, me, 0]);
  // Minimal valid Type-3 options: request 250k gas for remote lzReceive
  const options = buildLzV2OptionsLzReceiveGas(250_000n);

  // Router (ETH)
  const routerAbi = [
    "function quote(uint32,bytes,bytes) view returns (uint256 nativeFee, uint256 lzTokenFee)",
    "function sendSwapMessage(uint32,bytes,bytes) payable",
  ];
  const ethRouter = new ethers.Contract(ROUTER_ETH, routerAbi, ethWallet);

  // Step 3: Quote fee on ETH
  const fee = await ethRouter.quote(EID_ARB, payload, options);
  console.log("Quote:", { nativeFee: fee.nativeFee?.toString?.() ?? fee[0].toString(), lzTokenFee: fee.lzTokenFee?.toString?.() ?? fee[1].toString() });
  const nativeFee = fee.nativeFee ?? fee[0];

  // Step 4: Send message from ETH
  console.log("Sending message ETH -> ARB ...");
  const tx2 = await ethRouter.sendSwapMessage(EID_ARB, payload, options, { value: nativeFee });
  const rc2 = await tx2.wait();
  console.log("ETH send tx:", rc2?.hash);

  // Step 5: Confirm on ARB
  console.log("Waiting a few seconds for delivery...");
  await new Promise((r) => setTimeout(r, 8000));
  const ord = await arbEscrow.getOrder(nextId);
  console.log("ARB order after:", { status: ord.status, maker: ord.maker, amountIn: ord.amountIn.toString() });

  console.log("E2E complete.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
