// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOAppRouter} from "../interfaces/IOAppRouter.sol";
import {IEscrowCore} from "../interfaces/IEscrowCore.sol";

interface IMockEndpoint {
    function forward(uint64 srcEid, uint64 dstEid, bytes calldata payload) external;
}

/// @notice OApp-like Router: manages peers and uses MockEndpoint to forward messages
contract OAppRouter is IOAppRouter, Ownable {
    mapping(uint64 => bytes32) public peers; // peer address on remote chain (bytes32)
    IMockEndpoint public immutable endpoint; // mocked endpoint for tests
    IEscrowCore public immutable escrow; // optional local escrow to call on receive
    uint64 public immutable localEid; // local chain EID (for forward)

    constructor(address endpoint_, address escrow_, address owner_, uint64 localEid_) Ownable(owner_) {
        endpoint = IMockEndpoint(endpoint_);
        escrow = IEscrowCore(escrow_);
        localEid = localEid_;
    }

    function setPeer(uint64 eid, bytes32 peer) external override onlyOwner {
        peers[eid] = peer;
        emit PeerSet(eid, peer);
    }

    function sendSwapMessage(uint64 dstEid, bytes calldata payload) external payable override {
        // Only escrow or owner can send messages
        if (msg.sender != address(escrow) && msg.sender != owner()) {
            revert("NOT_AUTHORIZED");
        }
        emit MessageSent(dstEid, payload);
        // here, msg.sender is the local Escrow or privileged sender
        endpoint.forward(localEid, dstEid, payload);
    }

    function lzReceive(uint64 srcEid, bytes calldata payload) external override {
        require(msg.sender == address(endpoint), "ONLY_ENDPOINT");
        emit MessageReceived(srcEid, payload);
        // If escrow is set, try to decode and execute
        if (address(escrow) != address(0)) {
            (uint256 id, address to, uint256 minOut) = abi.decode(payload, (uint256, address, uint256));
            escrow.executeFromRemote(id, to, minOut);
        }
    }
}
