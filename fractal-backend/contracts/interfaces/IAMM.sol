// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAMM {
	// Events
	event LiquidityAdded(address indexed provider, uint256 ethAmount, uint256 usdcAmount);
	event LiquidityRemoved(address indexed provider, uint256 ethAmount, uint256 usdcAmount);
	event SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fee);

	// Add liquidity (ETH native + TestUSDC)
	function addLiquidity(uint256 usdcAmount) external payable;

	// Remove liquidity (pro-rata via LP shares)
	function removeLiquidity(uint256 lpAmount) external;

	// Swap ETH <-> TestUSDC
	function swapETHForUSDC(uint256 minUSDCOut) external payable;
	function swapUSDCForETH(uint256 usdcAmount, uint256 minETHOut) external;

	// Views
	function getReserves() external view returns (uint256 ethReserve, uint256 usdcReserve);
	function getLPBalance(address user) external view returns (uint256);
}

