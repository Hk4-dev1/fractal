// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOAppRouter} from "../interfaces/IOAppRouter.sol";
import {IEscrowCore} from "../interfaces/IEscrowCore.sol";

/// @notice Minimal placeholder router to simulate cross-chain messaging in tests.
contract SimpleRouter is IOAppRouter, Ownable {
    mapping(uint64 => bytes32) public peers;
    IEscrowCore public immutable escrow;

    constructor(address escrow_, address owner_) Ownable(owner_) {
        escrow = IEscrowCore(escrow_);
    }

    function setPeer(uint64 eid, bytes32 peer) external override onlyOwner {
        peers[eid] = peer;
        emit PeerSet(eid, peer);
    }

    function sendSwapMessage(uint64 dstEid, bytes calldata payload) external payable override {
        emit MessageSent(dstEid, payload);
        // In production this will send via LayerZero; here it's a no-op.
    }

    function lzReceive(uint64 srcEid, bytes calldata payload) external override {
        emit MessageReceived(srcEid, payload);
        // Minimal decode: (uint256 id, address to, uint256 minOut)
        (uint256 id, address to, uint256 minOut) = abi.decode(payload, (uint256, address, uint256));
        escrow.executeFromRemote(id, to, minOut);
    }
}
