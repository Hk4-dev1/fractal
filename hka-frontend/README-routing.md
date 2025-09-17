Configure LayerZero peers for non-ETH routes

This app supports multihop via Ethereum when direct peers aren’t set, but you must still configure peers involving Ethereum from each non-ETH chain.

1) Prereqs
- Node 18+
- Private key of the router owner (for setPeer transactions)
- RPC envs (optional but recommended):
  - RPC_ETHEREUM_SEPOLIA, RPC_ARBITRUM_SEPOLIA, RPC_OPTIMISM_SEPOLIA, RPC_BASE_SEPOLIA

2) Inspect
node scripts/lz-configure.mjs list
node scripts/lz-configure.mjs check

3) Set peers (examples)
# Make Arbitrum trust Ethereum
node scripts/lz-configure.mjs set arbitrum ethereum <PRIVATE_KEY>
# Make Optimism trust Ethereum
node scripts/lz-configure.mjs set optimism ethereum <PRIVATE_KEY>
# Make Base trust Ethereum
node scripts/lz-configure.mjs set base ethereum <PRIVATE_KEY>

Optional direct-first pairs:
node scripts/lz-configure.mjs set arbitrum optimism <PRIVATE_KEY>
node scripts/lz-configure.mjs set arbitrum base <PRIVATE_KEY>
node scripts/lz-configure.mjs set optimism base <PRIVATE_KEY>

4) Re-check
node scripts/lz-configure.mjs check

Once peers are set, the UI "Route not available" warning will disappear for non-ETH routes.
