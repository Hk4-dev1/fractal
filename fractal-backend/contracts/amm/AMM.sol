// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAMM} from "../interfaces/IAMM.sol";

/// @title Constant Product AMM for native ETH <-> TestUSDC (no WETH)
/// @notice Minimal x*y=k pool with LP shares and swap fee in bps accruing to reserves
contract AMM is IAMM, ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Immutable USDC token
    IERC20 public immutable usdc;

    // Reserves
    uint256 public ethReserve;
    uint256 public usdcReserve;

    // Fees (basis points). Example: 30 = 0.30%
    uint256 public immutable feeBps;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // Errors
    error InvalidAmount();
    error InsufficientLiquidity();
    error SlippageExceeded();

    constructor(IERC20 _usdc, uint256 _feeBps, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        require(address(_usdc) != address(0), "USDC addr");
        require(_feeBps < BPS_DENOMINATOR, "fee too high");
        usdc = _usdc;
        feeBps = _feeBps;
    }

    // Receive native ETH
    receive() external payable {}

    function getReserves() external view override returns (uint256, uint256) {
        return (ethReserve, usdcReserve);
    }

    function getLPBalance(address user) external view override returns (uint256) {
        return balanceOf(user);
    }

    function addLiquidity(uint256 usdcAmount) external payable override nonReentrant {
        if (msg.value == 0 || usdcAmount == 0) revert InvalidAmount();

        // Pull USDC from user first to avoid reentrancy surprises
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        uint256 ethUsed = msg.value;
        uint256 usdcUsed = usdcAmount;
        uint256 lpToMint;

        if (totalSupply() == 0) {
            // Initialize pool: LP = sqrt(eth * usdc)
            lpToMint = _sqrt(ethUsed * usdcUsed);
        } else {
            // Enforce ratio and refund excess on the non-limiting side
            // requiredUSDC for provided ETH at current price
            uint256 requiredUSDC = (ethUsed * usdcReserve) / ethReserve;
            if (usdcUsed > requiredUSDC) {
                uint256 refundUSDC = usdcUsed - requiredUSDC;
                usdcUsed = requiredUSDC;
                // refund extra USDC
                usdc.safeTransfer(msg.sender, refundUSDC);
            } else if (usdcUsed < requiredUSDC) {
                // ETH too much -> compute required ETH for provided USDC
                uint256 requiredETH = (usdcUsed * ethReserve) / usdcReserve;
                if (ethUsed > requiredETH) {
                    uint256 refundETH = ethUsed - requiredETH;
                    ethUsed = requiredETH;
                    // refund extra ETH
                    (bool ok, ) = msg.sender.call{value: refundETH}("");
                    require(ok, "eth refund");
                }
            }

            // Mint LP proportional to used contribution (should be equal by ratio)
            uint256 lpFromETH = (ethUsed * totalSupply()) / ethReserve;
            uint256 lpFromUSDC = (usdcUsed * totalSupply()) / usdcReserve;
            lpToMint = lpFromETH < lpFromUSDC ? lpFromETH : lpFromUSDC;
            if (lpToMint == 0) revert InvalidAmount();
        }

        ethReserve += ethUsed;
        usdcReserve += usdcUsed;

        _mint(msg.sender, lpToMint);

        emit LiquidityAdded(msg.sender, ethUsed, usdcUsed);
    }

    function removeLiquidity(uint256 lpAmount) external override nonReentrant {
    if (lpAmount == 0 || balanceOf(msg.sender) < lpAmount) revert InvalidAmount();
    if (totalSupply() == 0) revert InsufficientLiquidity();

    uint256 ethOut = (ethReserve * lpAmount) / totalSupply();
    uint256 usdcOut = (usdcReserve * lpAmount) / totalSupply();

        if (ethOut == 0 || usdcOut == 0) revert InsufficientLiquidity();

    // Update state before external calls
    _burn(msg.sender, lpAmount);

        ethReserve -= ethOut;
        usdcReserve -= usdcOut;

        // Payout
        (bool ok, ) = msg.sender.call{value: ethOut}("");
        require(ok, "eth xfer");
        usdc.safeTransfer(msg.sender, usdcOut);

        emit LiquidityRemoved(msg.sender, ethOut, usdcOut);
    }

    function swapETHForUSDC(uint256 minUSDCOut) external payable override nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (ethReserve == 0 || usdcReserve == 0) revert InsufficientLiquidity();

        // Apply fee on input
        uint256 amountInAfterFee = msg.value * (BPS_DENOMINATOR - feeBps) / BPS_DENOMINATOR;

        // x * y = k
        uint256 newEthReserve = ethReserve + amountInAfterFee;
        uint256 k = ethReserve * usdcReserve;
        uint256 newUsdcReserve = k / newEthReserve;
        uint256 usdcOut = usdcReserve - newUsdcReserve;

        if (usdcOut == 0 || usdcOut > usdcReserve) revert InsufficientLiquidity();
        if (usdcOut < minUSDCOut) revert SlippageExceeded();

        // Update reserves before external transfer
        ethReserve = ethReserve + msg.value; // full input increases ETH reserve
        usdcReserve = usdcReserve - usdcOut;

        usdc.safeTransfer(msg.sender, usdcOut);
        emit SwapExecuted(msg.sender, address(0), address(usdc), msg.value, usdcOut, (msg.value - amountInAfterFee));
    }

    function swapUSDCForETH(uint256 usdcAmount, uint256 minETHOut) external override nonReentrant {
        if (usdcAmount == 0) revert InvalidAmount();
        if (ethReserve == 0 || usdcReserve == 0) revert InsufficientLiquidity();

        // Pull USDC first
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        uint256 amountInAfterFee = usdcAmount * (BPS_DENOMINATOR - feeBps) / BPS_DENOMINATOR;

        uint256 newUsdcReserve = usdcReserve + amountInAfterFee;
        uint256 k = ethReserve * usdcReserve;
        uint256 newEthReserve = k / newUsdcReserve;
        uint256 ethOut = ethReserve - newEthReserve;

        if (ethOut == 0 || ethOut > ethReserve) revert InsufficientLiquidity();
        if (ethOut < minETHOut) revert SlippageExceeded();

        // Update before external transfer
        usdcReserve = usdcReserve + usdcAmount; // full input increases USDC reserve
        ethReserve = ethReserve - ethOut;

        (bool ok, ) = msg.sender.call{value: ethOut}("");
        require(ok, "eth xfer");
        emit SwapExecuted(msg.sender, address(usdc), address(0), usdcAmount, ethOut, (usdcAmount - amountInAfterFee));
    }

    // --- utilities ---
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y == 0) return 0;
        uint256 x = y / 2 + 1;
        z = y;
        while (x < z) {
            z = x;
            x = (y / x + x) / 2;
        }
    }
}
 
