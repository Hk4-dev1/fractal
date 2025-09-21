// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IEscrowCore} from "../interfaces/IEscrowCore.sol";

// Minimal interface for the OApp router send function (top-level interface)
interface IOAppSend {
    function sendSwapMessage(uint32 dstEid, bytes calldata payload, bytes calldata options) external payable;
}

contract EscrowCore is IEscrowCore, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Order storage
    uint256 public nextOrderId;
    mapping(uint256 => Order) private _orders;

    // Fees (bps) and treasuries
    uint256 public escrowFeeBps; // source chain escrow fee
    uint256 public protocolFeeBps; // protocol fee
    address public treasuryEscrow;
    address public treasuryProtocol;

    // Authorized router to call executeFromRemote
    address public router;

    event RouterSet(address indexed router);
    event FeesUpdated(uint256 escrowFeeBps, uint256 protocolFeeBps, address treasuryEscrow, address treasuryProtocol);

    error InvalidParam();
    error Unauthorized();
    error BadStatus();

    constructor(
        address _owner,
        uint256 _escrowFeeBps,
        uint256 _protocolFeeBps,
        address _treasuryEscrow,
        address _treasuryProtocol
    ) Ownable(_owner) {
        if (_treasuryEscrow == address(0) || _treasuryProtocol == address(0)) revert InvalidParam();
        if (_escrowFeeBps + _protocolFeeBps >= 10_000) revert InvalidParam();
        escrowFeeBps = _escrowFeeBps;
        protocolFeeBps = _protocolFeeBps;
        treasuryEscrow = _treasuryEscrow;
        treasuryProtocol = _treasuryProtocol;
        nextOrderId = 1;
    }

    function setRouter(address _router) external onlyOwner {
        router = _router;
        emit RouterSet(_router);
    }

    /// @notice Dispatch the cross-chain execution message for an order.
    /// Maker calls this to initiate LayerZero message from escrow (authorized sender for router).
    /// @param id Order id created on this chain
    /// @param to Recipient address on destination chain
    /// @param minAmountOut Minimum acceptable amount on destination (passed through payload)
    /// @param options LayerZero V2 options bytes (Type-3 executor gas, etc.)
    function dispatchToDst(
        uint256 id,
        address to,
        uint256 minAmountOut,
        bytes calldata options
    ) external payable nonReentrant {
        Order storage ord = _orders[id];
        if (ord.status != OrderStatus.Created) revert BadStatus();
        if (ord.maker != msg.sender) revert Unauthorized();
        if (router == address(0)) revert InvalidParam();
        // Encode payload for OAppRouterV2.lzReceive
        // If same-asset ETH bridging (tokenIn==tokenOut==ETH), send amount so DST can payout without a local order.
        bytes memory payload;
        if (ord.tokenIn == address(0) && ord.tokenOut == address(0)) {
            payload = abi.encode(ord.amountIn, to, minAmountOut);
        } else {
            payload = abi.encode(id, to, minAmountOut);
        }
        // Send via router; this contract is authorized in router.sendSwapMessage
    IOAppSend(router).sendSwapMessage{ value: msg.value }(uint32(ord.dstEid), payload, options);
        // msg.value is consumed by Endpoint via router; any overpayment is kept by router/endpoint per implementation
    }

    function setFees(uint256 _escrowFeeBps, uint256 _protocolFeeBps, address _treasuryEscrow, address _treasuryProtocol) external onlyOwner {
        if (_treasuryEscrow == address(0) || _treasuryProtocol == address(0)) revert InvalidParam();
        if (_escrowFeeBps + _protocolFeeBps >= 10_000) revert InvalidParam();
        escrowFeeBps = _escrowFeeBps;
        protocolFeeBps = _protocolFeeBps;
        treasuryEscrow = _treasuryEscrow;
        treasuryProtocol = _treasuryProtocol;
        emit FeesUpdated(_escrowFeeBps, _protocolFeeBps, _treasuryEscrow, _treasuryProtocol);
    }

    function createOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint64 dstEid
    ) external payable nonReentrant returns (uint256 id) {
        if (amountIn == 0) revert InvalidParam();

        // Calculate fees and net amount
        uint256 escrowFee = (amountIn * escrowFeeBps) / 10_000;
        uint256 protocolFee = (amountIn * protocolFeeBps) / 10_000;
        uint256 netAmount = amountIn - escrowFee - protocolFee;
        if (netAmount == 0) revert InvalidParam();

        if (tokenIn == address(0)) {
            // Native ETH: user must send at least amountIn
            if (msg.value < amountIn) revert InvalidParam();
            // Route fees immediately
            _safeSendETH(treasuryEscrow, escrowFee);
            _safeSendETH(treasuryProtocol, protocolFee);
            // Keep net amount in contract as escrowed
            uint256 excess = msg.value - amountIn;
            if (excess > 0) _safeSendETH(msg.sender, excess);
        } else {
            // ERC20: pull tokens then route fees and keep net
            IERC20 token = IERC20(tokenIn);
            token.safeTransferFrom(msg.sender, address(this), amountIn);
            if (escrowFee > 0) token.safeTransfer(treasuryEscrow, escrowFee);
            if (protocolFee > 0) token.safeTransfer(treasuryProtocol, protocolFee);
        }

        id = nextOrderId++;
        _orders[id] = Order({
            maker: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: netAmount,
            minAmountOut: minAmountOut,
            dstEid: dstEid,
            createdAt: block.timestamp,
            status: OrderStatus.Created
        });

        emit OrderCreated(id, msg.sender, tokenIn, tokenOut, amountIn, minAmountOut, dstEid);
    }

    function cancelOrder(uint256 id) external nonReentrant {
        Order storage ord = _orders[id];
        if (ord.status != OrderStatus.Created) revert BadStatus();
        if (ord.maker != msg.sender) revert Unauthorized();

        ord.status = OrderStatus.Cancelled;

        // Refund net escrowed amount (fees sudah disalurkan saat create)
        if (ord.tokenIn == address(0)) {
            _safeSendETH(ord.maker, ord.amountIn);
        } else {
            IERC20(ord.tokenIn).safeTransfer(ord.maker, ord.amountIn);
        }

        emit OrderCancelled(id, msg.sender);
    }

    function executeFromRemote(uint256 id, address to, uint256 /*minAmountOut*/ ) external nonReentrant {
        if (msg.sender != router) revert Unauthorized();
        Order storage ord = _orders[id];
        if (ord.status != OrderStatus.Created) revert BadStatus();

        ord.status = OrderStatus.Executed;

        // v0: Payout the escrowed input token to recipient on this chain.
        // (Swap/integration with AMM and real cross-chain settlement datang di fase OApp integrasi)
        if (ord.tokenIn == address(0)) {
            _safeSendETH(to, ord.amountIn);
        } else {
            IERC20(ord.tokenIn).safeTransfer(to, ord.amountIn);
        }

        emit OrderExecuted(id, msg.sender, ord.amountIn);
    }

    /// @notice Direct ETH payout used for same-asset bridging fallback. Callable only by router.
    function payoutETH(address to, uint256 amount) external nonReentrant {
        if (msg.sender != router) revert Unauthorized();
        require(to != address(0) && amount > 0, "BAD_ARGS");
        _safeSendETH(to, amount);
    }

    function getOrder(uint256 id) external view returns (Order memory) {
        return _orders[id];
    }

    // --- internals ---
    function _safeSendETH(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ETH_SEND_FAIL");
    }

    receive() external payable {}
}
