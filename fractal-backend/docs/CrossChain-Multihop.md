# Cross-Chain Multihop (Temporary Workaround)

When a direct LayerZero v2 path is unavailable or quote() reverts (e.g., OP → ARB on testnet), you can route via a hub chain (e.g., ETH) to complete delivery in two legs.

## How it works
- Leg 1: SRC → HOP
  - On DST=HOP, an order is created in EscrowCore (with srcEid=SRC)
  - On SRC, OAppRouterV2 sends LZ v2 message to HOP to execute the order
- Leg 2: HOP → DST
  - On DST, another order is created in EscrowCore (with srcEid=HOP)
  - On HOP, OAppRouterV2 sends LZ v2 message to DST to execute the order
- Script: `scripts/e2e-v2-multihop.ts`

## Fees impact
Multihop doubles the messaging legs, so fees are roughly additive:
- LayerZero messaging fee (nativeFee): paid once per leg
  - Total messaging fee ≈ fee(SRC→HOP) + fee(HOP→DST)
  - Each fee is quoted with the same options (Type-3, executor lzReceive gas). Gas settings affect fee per leg
- Local Escrow fees: apply per order creation on each destination chain
  - Escrow fee (0.30%) + Protocol fee (0.05%) are taken at createOrder for each leg’s destination chain
  - If you model multihop as two separate releases, you incur fees twice (once on HOP, once on final DST)
  - If your business flow intends a single net settlement, consider batching or deferring actual value release to only the final leg (out of scope for the simple demo)

In our demo scripts, we create an order on each leg’s destination, so both legs incur their respective local escrow fees. For production, you can:
- Minimize duplicated fees by designing HOP leg to pass-through without a user-visible swap/release (e.g., internal staging intent), then only take user-facing fees at final DST
- Or maintain current behavior if acceptable for initial testnet proving

## Pros & Cons
- Pros:
  - Unblocks routes while waiting for endpoint path config to be available on testnet
  - Uses the same OApp contracts & options; no contract changes required
- Cons:
  - Higher total fee (2x LZ messaging, potentially 2x local escrow fee depending on flow)
  - Slightly longer latency (two deliveries)

## Usage
- Preset OP → ARB via ETH:
  ```bash
  npm run e2e:v2:op-arb:multihop
  ```
- Custom multihop:
  ```bash
  SRC_CHAIN_KEY=<src> DST_CHAIN_KEY=<dst> HOP_CHAIN_KEY=<hop> npm run e2e:v2:multihop
  ```

## Tuning options
- Adjust executor gas in options if payload grows:
  - In scripts: edit `buildOptions( /* gas */ )` from 250_000 to your needed value
- Consider native drop options if you need to airdrop gas on the destination (not used in this demo)

## Tracking
- The OP → ARB direct route reverts on quote() at time of writing; once LayerZero enables default send library for OP→ARB on testnet, direct path should work and multihop can be removed for that pair.
