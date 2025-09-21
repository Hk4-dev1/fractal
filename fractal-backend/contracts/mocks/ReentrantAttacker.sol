// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAMMForAttack {
    function removeLiquidity(uint256 lpAmount) external;
    function swapUSDCForETH(uint256 usdcAmount, uint256 minETHOut) external;
}

interface IERC20Like {
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Attacker that tries to reenter AMM on receiving ETH
contract ReentrantAttacker {
    IAMMForAttack public amm;
    IERC20Like public usdc;
    bool public tryReenter;

    constructor(address _amm, address _usdc) {
        amm = IAMMForAttack(_amm);
        usdc = IERC20Like(_usdc);
    }

    receive() external payable {
        if (tryReenter) {
            tryReenter = false;
            // Attempt a reentrant call (should fail due to nonReentrant)
            try amm.removeLiquidity(1) {} catch {}
        }
    }

    function setTryReenter(bool v) external { tryReenter = v; }
}
