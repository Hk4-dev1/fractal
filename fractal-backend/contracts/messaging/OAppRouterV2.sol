// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IEscrowCore} from "../interfaces/IEscrowCore.sol";
import { ILayerZeroEndpointV2, MessagingParams, MessagingFee, Origin } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

interface IOAppRouterV2Events {
    event V2PeerSet(uint64 eid, bytes32 peer);
    event V2MessageSent(uint32 dstEid, bytes payload, bytes options);
    event V2MessageReceived(uint32 srcEid, bytes payload);
}

/// @notice Minimal LayerZero v2 router integrated directly with EndpointV2. Peers are managed per-eid.
contract OAppRouterV2 is Ownable, IOAppRouterV2Events {
    ILayerZeroEndpointV2 public immutable endpoint;
    IEscrowCore public immutable escrow;
    mapping(uint32 => bytes32) public peers;

    constructor(address _endpoint, address _escrow, address _owner) Ownable(_owner) {
        require(_endpoint != address(0) && _escrow != address(0) && _owner != address(0), "BAD_ARGS");
        endpoint = ILayerZeroEndpointV2(_endpoint);
        escrow = IEscrowCore(_escrow);
    }

    function setPeer(uint64 eid, bytes32 peer) external onlyOwner {
        uint32 e = uint32(eid);
        peers[e] = peer;
        emit V2PeerSet(eid, peer);
    }

    /// @notice Set the delegate on the Endpoint for this OApp (optional but recommended)
    function setDelegate(address _delegate) external onlyOwner {
        endpoint.setDelegate(_delegate);
    }

    function _getPeerOrRevert(uint32 eid) internal view returns (bytes32) {
        bytes32 p = peers[eid];
        require(p != bytes32(0), "NO_PEER");
        return p;
    }

    function quote(uint32 dstEid, bytes calldata payload, bytes calldata options) external view returns (MessagingFee memory fee) {
        fee = endpoint.quote(MessagingParams(dstEid, _getPeerOrRevert(dstEid), payload, options, false), address(this));
    }

    function sendSwapMessage(uint32 dstEid, bytes calldata payload, bytes calldata options) external payable {
        if (msg.sender != address(escrow) && msg.sender != owner()) revert("NOT_AUTHORIZED");
        MessagingFee memory fee = endpoint.quote(MessagingParams(dstEid, _getPeerOrRevert(dstEid), payload, options, false), address(this));
        require(msg.value >= fee.nativeFee, "INSUFFICIENT_FEE");
        endpoint.send{ value: fee.nativeFee }(MessagingParams(dstEid, _getPeerOrRevert(dstEid), payload, options, false), msg.sender);
        emit V2MessageSent(dstEid, payload, options);
    }

    function lzReceive(Origin calldata _origin, bytes32 /*guid*/, bytes calldata _message, address /*executor*/, bytes calldata /*extra*/ ) external payable {
        require(msg.sender == address(endpoint), "ONLY_ENDPOINT");
        require(peers[_origin.srcEid] == _origin.sender, "ONLY_PEER");
        emit V2MessageReceived(_origin.srcEid, _message);
        (uint256 idOrAmount, address to, uint256 minOut) = abi.decode(_message, (uint256, address, uint256));
        // If a matching order exists and is Created, execute it. Otherwise, interpret idOrAmount as amount and payout ETH.
        try escrow.getOrder(idOrAmount) returns (IEscrowCore.Order memory ord) {
            if (ord.status == IEscrowCore.OrderStatus.Created) {
                escrow.executeFromRemote(idOrAmount, to, minOut);
            } else if (ord.status == IEscrowCore.OrderStatus.None) {
                // Same-asset ETH bridge payout; requires destination escrow pre-funded with ETH
                escrow.payoutETH(to, idOrAmount);
            } else {
                // Already executed/cancelled
                revert("BAD_ORDER_STATE");
            }
        } catch {
            // If getOrder reverts (e.g., selector mismatch), fallback to payout ETH with amount
            escrow.payoutETH(to, idOrAmount);
        }
    }
}
