import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Signer:", me);

  const escrowAddr = process.env.ESCROW_ADDRESS;
  if (!escrowAddr) throw new Error("Set ESCROW_ADDRESS in .env for the selected --network");

  const escrowAbi = [
    "function treasuryEscrow() view returns (address)",
    "function treasuryProtocol() view returns (address)",
    "function escrowFeeBps() view returns (uint256)",
    "function protocolFeeBps() view returns (uint256)",
    "function nextOrderId() view returns (uint256)",
    "function getOrder(uint256) view returns (tuple(address maker,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid,uint256 createdAt,uint8 status))",
    "function createOrder(address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint64 dstEid) payable returns (uint256)",
    "function executeFromRemote(uint256 id, address to, uint256 minOut)"
  ];

  const escrow = new ethers.Contract(escrowAddr, escrowAbi, signer);

  const tEscrow: string = await escrow.treasuryEscrow();
  const tProtocol: string = await escrow.treasuryProtocol();
  const feeEscrow: bigint = await escrow.escrowFeeBps();
  const feeProtocol: bigint = await escrow.protocolFeeBps();
  const nextId: bigint = await escrow.nextOrderId();

  console.log("Treasuries:", { tEscrow, tProtocol, feeEscrow: feeEscrow.toString(), feeProtocol: feeProtocol.toString(), nextId: nextId.toString() });

  const amt = ethers.parseEther("0.002");
  const dstEid = 40161n; // arbitrary for demo; not used by escrow beyond storage

  const balEscrowBefore = await ethers.provider.getBalance(tEscrow);
  const balProtocolBefore = await ethers.provider.getBalance(tProtocol);

  console.log("Creating order...", { amt: amt.toString(), dstEid: dstEid.toString() });
  const tx = await escrow.createOrder(
    ethers.ZeroAddress,
    ethers.ZeroAddress,
    amt,
    0,
    dstEid,
    { value: amt }
  );
  const rc = await tx.wait();
  console.log("createOrder tx:", rc?.hash);

  const balEscrowAfter = await ethers.provider.getBalance(tEscrow);
  const balProtocolAfter = await ethers.provider.getBalance(tProtocol);

  const expectedEscrowFee = (amt * feeEscrow) / 10000n;
  const expectedProtocolFee = (amt * feeProtocol) / 10000n;

  console.log("Fee deltas:", {
    escrowDelta: (balEscrowAfter - balEscrowBefore).toString(),
    protocolDelta: (balProtocolAfter - balProtocolBefore).toString(),
    expectedEscrowFee: expectedEscrowFee.toString(),
    expectedProtocolFee: expectedProtocolFee.toString(),
  });

  const order = await escrow.getOrder(nextId);
  console.log("Order stored:", {
    id: nextId.toString(),
    maker: order.maker,
    tokenIn: order.tokenIn,
    amountIn: order.amountIn.toString(),
    status: order.status,
  });

  // Negative test: executeFromRemote must be router-only, so this should revert
  try {
    await escrow.executeFromRemote(nextId, me, 0);
    console.error("executeFromRemote unexpectedly succeeded (should be Unauthorized)");
  } catch (e: any) {
    console.log("executeFromRemote revert (expected):", e?.message || e);
  }

  console.log("Smoke test complete.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
