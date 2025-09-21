// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IOAppReceiver {
    function lzReceive(uint64 srcEid, bytes calldata payload) external;
}

contract MockEndpoint {
    // Map EID to router address
    mapping(uint64 => address) public routerOfEid;

    event RouterSet(uint64 indexed eid, address router);
    event Forwarded(uint64 indexed srcEid, uint64 indexed dstEid, address dstRouter);

    function setRouter(uint64 eid, address router) external {
        routerOfEid[eid] = router;
        emit RouterSet(eid, router);
    }

    function forward(uint64 srcEid, uint64 dstEid, bytes calldata payload) external {
        address dst = routerOfEid[dstEid];
        require(dst != address(0), "no dst router");
        IOAppReceiver(dst).lzReceive(srcEid, payload);
        emit Forwarded(srcEid, dstEid, dst);
    }
}
