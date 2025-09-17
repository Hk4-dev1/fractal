Cross-chain routing notes

1) EIDs must match deployments
- Keep a single source of truth for LayerZero EIDs. The app now reads EIDs from services/contracts.ts (CONTRACTS[*].layerZeroEid) inside crosschainRouter to avoid mismatches.

2) Peers must be set on-chain
- Each router needs setPeer for every destination route you want to support. For direct-first:
  - ETH ↔ ARB, ETH ↔ OP, ETH ↔ BASE
- For non-ETH pairs without direct support, multihop uses ETH. Ensure A ↔ ETH and ETH ↔ B are set.

3) Frontend behavior
- The UI probes route health and disables the button with a clear message if a pair isn’t configured.

4) Debugging
- If a pair shows "Route not available", verify both EIDs and peers for that pair. Check ROUTERS addresses and RPC availability.
