// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IEscrowCore {
	enum OrderStatus { None, Created, Cancelled, Executed }

	struct Order {
		address maker;
		address tokenIn; // address(0) for native ETH
		address tokenOut; // USDC on this chain
		uint256 amountIn;
		uint256 minAmountOut;
		uint64 dstEid; // destination chain id (LayerZero EID or domain)
		uint256 createdAt;
		OrderStatus status;
	}

	// Events
	event OrderCreated(uint256 indexed id, address indexed maker, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint64 dstEid);
	event OrderCancelled(uint256 indexed id, address indexed maker);
	event OrderExecuted(uint256 indexed id, address indexed executor, uint256 amountOut);

	function createOrder(
		address tokenIn,
		address tokenOut,
		uint256 amountIn,
		uint256 minAmountOut,
		uint64 dstEid
	) external payable returns (uint256 id);

	function cancelOrder(uint256 id) external;

	// Called by router on message receive to execute local swap/payout
	function executeFromRemote(uint256 id, address to, uint256 minAmountOut) external;

	// Direct payout hook for same-asset bridging (router-initiated)
	function payoutETH(address to, uint256 amount) external;

	// Client-facing method to initiate cross-chain execution message from Escrow
	function dispatchToDst(uint256 id, address to, uint256 minAmountOut, bytes calldata options) external payable;

	function getOrder(uint256 id) external view returns (Order memory);
}

