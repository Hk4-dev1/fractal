# LayerZero v2 Testnet Setup (ETH Sepolia, Arbitrum Sepolia, Optimism Sepolia, Base Sepolia)

This guide lists what you must fill to deploy OApp routers across 4 testnets and wire full-mesh peers.

Important: Always verify EIDs and endpoint addresses from the official LayerZero docs (Deployments → Deployed Contracts → Testnet). Do not trust copies.

## Required values per chain
- RPC URL (public or provider)
- LayerZero Endpoint Address (contract address)
- LayerZero EID (Endpoint ID, uint64)

Chains in scope
- Ethereum Sepolia (ETH)
- Arbitrum Sepolia (ARB)
- Optimism Sepolia (OP)
- Base Sepolia (BASE)

## Where to find official values
- LayerZero Docs → Deployments → Deployed contracts → Testnet
  - Endpoint address and EID for each chain are listed there.

If docs are not reachable, check LayerZero Discord or GitHub releases for the latest deployments.

## Example public RPCs (you can swap to your provider)
- ETH Sepolia: https://eth-sepolia.public.blastapi.io (or https://rpc.sepolia.org)
- Arbitrum Sepolia: https://sepolia-rollup.arbitrum.io/rpc (or a public gateway like Blast)
- Optimism Sepolia: https://sepolia.optimism.io
- Base Sepolia: https://sepolia.base.org

## .env keys to populate
Update `fractal-backend/.env` (or copy from `.env.example`).

- Global
  - PRIVATE_KEY=0x...
- RPC per chain
  - ETH_SEPOLIA_RPC_URL=
  - ARB_SEPOLIA_RPC_URL=
  - OP_SEPOLIA_RPC_URL=
  - BASE_SEPOLIA_RPC_URL=
- LayerZero endpoint addresses per chain
  - LZ_ENDPOINT_ETH_SEPOLIA=
  - LZ_ENDPOINT_ARB_SEPOLIA=
  - LZ_ENDPOINT_OP_SEPOLIA=
  - LZ_ENDPOINT_BASE_SEPOLIA=
- LayerZero EIDs per chain (uint64)
  - LZ_EID_ETH_SEPOLIA=
  - LZ_EID_ARB_SEPOLIA=
  - LZ_EID_OP_SEPOLIA=
  - LZ_EID_BASE_SEPOLIA=

## Deployment flow (high level)
1) Deploy EscrowCore on all 4 chains (store addresses).
2) Deploy OAppRouterLZ on all 4 chains with:
   - endpoint address (for that chain)
   - escrow address (for that chain)
   - local EID (for that chain)
3) Wire peers (full-mesh):
   - SetPeer on each router for the other 3 chains using their EIDs and router addresses encoded to bytes32.
4) Set router on each EscrowCore to point to its local OAppRouterLZ.
5) Smoke test: send a small message across each pair to confirm lzReceive works.

## Notes
- Ensure PRIVATE_KEY has testnet funds on all 4 chains.
- Escrow and Protocol treasuries must be able to receive small fees.
- Start with small gas settings; some LZ options (executor/dvn) can be set to defaults per examples in the docs.

### Multi-hop routing (temporary workaround)
- Jika direct path antar dua chain gagal (contoh OP → ARB), gunakan multi-hop via chain hub (contoh OP → ETH → ARB).
- Dampak biaya dan detail lengkap lihat: docs/CrossChain-Multihop.md
