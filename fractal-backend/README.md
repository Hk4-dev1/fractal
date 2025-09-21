# Fractal Backend (AMM + Escrow + Router)

Minimal backend for ETH native ↔ TestUSDC AMM, EscrowCore with source-chain fees, and a simple Router placeholder. No WETH.

## Prerequisites
- Node.js 18+
- Funded Sepolia account for deploy

## Setup
1. Install deps
   - npm ci
2. Copy env
   - cp .env.example .env
3. Fill .env
   - SEPOLIA_RPC_URL, PRIVATE_KEY
   - TREASURY_ESCROW, TREASURY_PROTOCOL
   - INITIAL_ETH_LIQUIDITY, INITIAL_USDC_LIQUIDITY, AMM_FEE_BPS
   - LP_NAME, LP_SYMBOL (default: ETHsep/mockUSDC)

## Dev
- Compile: npm run build
- Test: npm test

## Deploy (Sepolia)
- AMM + MockUSDC
  - npm run deploy:amm
- Escrow + Router
  - npm run deploy:escrow
 - OAppRouter (LayerZero-like)
    - Fill .env: LOCAL_EID, ESCROW_ADDRESS, optionally OAPP_ENDPOINT. For peer wiring, set PEER_EIDS and PEER_ADDRESSES (comma-separated).
    - npm run deploy:oapp
 - Local Mock 2-Chain Topology (for end-to-end dev without real endpoints)
    - Optionally set LOCAL_EID_A, LOCAL_EID_B (defaults 10001/10002)
    - npm run deploy:mock2
   - Mock 2-Chain Demo (deploy + create order + message send + execute)
      - Ensure TREASURY_ESCROW and TREASURY_PROTOCOL in .env
      - npm run mock2:demo

Outputs print addresses and reserves to console.

## Multi-chain Testnet (LayerZero v2)

Supported testnets: Ethereum Sepolia, Arbitrum Sepolia, Optimism Sepolia, Base Sepolia.

1) Fill .env
- PRIVATE_KEY
- ETH_SEPOLIA_RPC_URL, ARB_SEPOLIA_RPC_URL, OP_SEPOLIA_RPC_URL, BASE_SEPOLIA_RPC_URL
- For convenience, CHAIN_KEY per deploy (ethereum-sepolia | arbitrum-sepolia | optimism-sepolia | base-sepolia)
- LZ_* already prefilled from official metadata (EIDs + endpointV2)

2) Deploy Escrow + OAppRouter on each chain
- Set CHAIN_KEY appropriately and ESCROW_ADDRESS (if reusing an existing deployment)
- Ethereum Sepolia
   - npm run deploy:escrow (or reuse existing address)
   - npm run deploy:oapp
   - Save OAppRouter address into ROUTER_ETH_SEPOLIA in .env
- Arbitrum Sepolia
   - npm run deploy:escrow:arb
   - npm run deploy:oapp:arb
   - Save into ROUTER_ARB_SEPOLIA
- Optimism Sepolia
   - npm run deploy:escrow:op
   - npm run deploy:oapp:op
   - Save into ROUTER_OP_SEPOLIA
- Base Sepolia
   - npm run deploy:escrow:base
   - npm run deploy:oapp:base
   - Save into ROUTER_BASE_SEPOLIA

3) Full-mesh peer wiring
- Ensure at least two ROUTER_* are filled; for full mesh, fill all four
- npm run wire:peers
- This sets setPeer(eid, peer) for every pair so all 6 routes are enabled.

4) Verify config
- Set CHAIN_KEY then:
   - npm run lz:config

Notes
- OAppRouter here uses a mock-like interface; we wired it for endpointV2 addresses and v2 EIDs. When migrating to the official LZ OApp, adapt the interfaces but keep EID/peer wiring logic and env layout.

## Notes
- AMM fees accrue to the pool.
- Escrow and Protocol fees are routed to treasuries on order creation.
- Router here is a local placeholder; LayerZero OApp will replace it later.
 - OAppRouter script supports a real endpoint address or deploys MockEndpoint for local-style testing. Ensure Escrow owner calls succeeded when wiring router/peers.
 - The mock 2-chain script deploys: one MockEndpoint, two EscrowCore, and two OAppRouter with peer wiring, so you can simulate cross-chain flow entirely locally.
