# Fractal Backend (AMM + Escrow + Router)

Minimal backend for ETH native ↔ TestUSDC AMM, EscrowCore with source-chain fees, a LayerZero-style OAppRouter, plus supporting multi‑chain wiring utilities. Fully migrated to viem (no ethers anywhere: scripts or tests). No WETH.

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

## Unified Script + Test Architecture (Post-Migration)

All execution paths (scripts + tests) use viem clients. Patterns:
* Shared utilities in `scripts/core/`:
   * `env.ts` (raw / addr / optional + validation)
   * `address.ts` (address assertion + normalization)
   * `options.ts` (LayerZero type-3 executor option builder)
   * `contract.ts` (central ABIs + helpers: quote, sendSwap, readNextId, readOwner, readFees, setFees, setRouter, endpointInspectAbi)
   * `bootstrap.ts` (environment grouping + validation entrypoints)
   * `log.ts` (structured JSON-ish logging + timing via `time()`)
   * `flags.ts` (`isDryRun`)
* No ethers imports anywhere (enforced by guards).
* All env addresses validated through `addr()` prior to on-chain calls.
* Centralized ABIs: no ad‑hoc large inline arrays or broad `parseAbi` calls sprinkled across scripts.
* Event decoding in tests uses `decodeEventLog` with canonical ABIs + `expectSingleEvent` helper to ensure exactly one matching event.

### Adding a New Script
1. Import helpers: `import { addr, raw } from './core/env';` plus needed contract helpers.
2. Validate environment early (`ensureAllRpcs()` or targeted group from `bootstrap`).
3. Build explicit chain objects (id, name, rpcUrls) for wallet/public clients.
4. Reuse shared ABIs from `contract.ts`; if you genuinely need a one-off single-function ABI, a tiny `parseAbi(['function foo(...)'])` is allowed, but prefer centralization.
5. Log with `logStep(label, data?)`; bracket state-changing tx with `something:start` and `something:confirmed`.
6. Honor `--dry-run` (skip writes / deployments, still perform reads + quotes) by checking `isDryRun` before each write.

### Logging & Dry-Run
* `logStep(label, data?)` prints `[ISO_TIMESTAMP] label: <optional JSON>`.
* `time(label, asyncFn)` measures execution latency.
* `--dry-run` behavior (consistent across deploy + wiring scripts):
   - Skips deployments and writeContract calls (substitutes placeholder sentinel addresses where needed)
   - Still builds clients, performs calculations/quotes, validates environment
   - Emits identical structural log labels for diffing planned vs real runs

Example:
```
[2025-09-25T10:12:05.123Z] deploy:init: {"deployer":"0x...","dryRun":true}
[2025-09-25T10:12:05.456Z] deploy:mockUSDC:skip
[2025-09-25T10:12:05.789Z] deploy:amm:skip
[2025-09-25T10:12:05.900Z] deploy:complete:{"usdc":"0x0000...dEaD","amm":"0x0000...aAaA"}
```

Guidelines:
* Always emit an initial `*:init` (or `deploy:init`) and closing `*:complete` label.
* For tx flows: `foo:start` -> (optional interim logs) -> `foo:confirmed` (include hash & gasUsed where available).
* Cross-chain flows: include `{ sourceChain, dstChain, orderId }` or at least `{ chain }` to make logs greppable.

### Test Architecture (viem)
* All tests use viem wallet & public clients from Hardhat's viem integration.
* Helpers: `test/utils/viem-helpers.ts` (deploy functions, `AMM_ABI`), `test/utils/assert.ts` (revert + event helpers).
* Event discipline: `expectSingleEvent(logs, 'EventName', predicate?)` ensures no silent duplicates.
* Revert checks: `expectRevert(promise, /reason/)` standardizes failure assertions.
* Case-insensitive address comparisons; numeric values normalized with BigInt.

### Guard Tests
* `test/no-ethers-import.test.ts` – blocks ethers in scripts.
* `test/no-ethers-in-tests.test.ts` – blocks ethers in the test suite.
* `test/no-inline-abi.test.ts` – forbids broad inline ABI arrays or multi-item `parseAbi` usage outside `scripts/core/contract.ts`. (Single-function one-offs allowed.)

### Adding / Updating ABIs
* Put shared fragments in `scripts/core/contract.ts` (keep them minimal; only what scripts or tests actually need).
* Prefer extending existing arrays vs creating new duplicates.
* If adding a brand-new contract interface used across multiple scripts/tests, centralize it first, then import everywhere.
* Avoid copying full compiler-generated ABIs; extract only required function + event signatures (simplifies event decoding + guard compliance).

### Event Decoding Tips
* Always decode using the minimal ABI containing the event signature.
* If multiple events share the same name across different contracts in a test, narrow by `address` AND topics.
* Guard helpers already lowercase addresses to avoid checksum mismatch noise.

### Migration Status
* 100% viem: scripts + tests.
* Ethers + related plugins removed from `package.json` (guarded against reintroduction).
* Central ABIs & strict event decoding complete.

### Future Improvements (Optional)
* Further documentation for cross-chain message fee quoting nuances.
* Decode order IDs directly from event data (replace topic index extraction where still used).
* CI: fail fast job dedicated to guard tests + lint + typecheck.


