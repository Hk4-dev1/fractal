// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IOAppRouter {
	event PeerSet(uint64 indexed eid, bytes32 peer);
	event MessageSent(uint64 indexed dstEid, bytes payload);
	event MessageReceived(uint64 indexed srcEid, bytes payload);

	function setPeer(uint64 eid, bytes32 peer) external;

	// Encodes a swap/execution message to the peer OApp on another chain
	function sendSwapMessage(uint64 dstEid, bytes calldata payload) external payable;

	// Called by the messaging endpoint to deliver message
	function lzReceive(uint64 srcEid, bytes calldata payload) external;
}

