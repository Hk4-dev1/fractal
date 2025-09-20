# Fractal Monorepo

[![Backend Health](https://github.com/Hk4-dev1/fractal/actions/workflows/backend-health.yml/badge.svg)](https://github.com/Hk4-dev1/fractal/actions/workflows/backend-health.yml)

This repo contains:
- fractal-backend: LayerZero v2 wiring scripts and health checks
- hka-frontend: React/Vite UI with public RPC defaults and a Health page

## GitHub Actions CI setup

Two workflows are included:
- Frontend CI: builds and type-checks the frontend on pushes and PRs to main.
- Backend Health: runs hourly and on demand to verify cross-chain wiring (read-only).

### Required repository secrets
Add these repository secrets in GitHub (Settings → Secrets and variables → Actions → New repository secret):
- ETH_SEPOLIA_RPC_URL
- ARB_SEPOLIA_RPC_URL
- OP_SEPOLIA_RPC_URL
- BASE_SEPOLIA_RPC_URL

Notes:
- These are used only by Backend Health (read-only). Use any reliable RPC provider (Infura, Alchemy, Blast, etc.).
- PRIVATE_KEY is not required; the workflow uses a dummy key for read-only calls.

### Quick setup via gh CLI (optional)
If you have GitHub CLI authenticated for this repo:

```sh
# Replace the example URLs with your actual endpoints
gh secret set ETH_SEPOLIA_RPC_URL -b "https://sepolia.infura.io/v3/<KEY>"
gh secret set ARB_SEPOLIA_RPC_URL -b "https://arbitrum-sepolia.infura.io/v3/<KEY>"
gh secret set OP_SEPOLIA_RPC_URL  -b "https://optimism-sepolia.infura.io/v3/<KEY>"
gh secret set BASE_SEPOLIA_RPC_URL -b "https://base-sepolia.infura.io/v3/<KEY>"
```

## One-liner to set GitHub RPC secrets

Requires GitHub CLI logged in and your RPCs present in `hka-frontend/.env` under either VITE_RPC_* or RPC_*.

```sh
cd hka-frontend && npm run set:gh-secrets
```

### Triggering the health check
- Manually: Actions → Backend Health → Run workflow
- On schedule: runs every hour (cron: `0 * * * *`)

## Local development
Frontend:
- cd hka-frontend
- npm install
- npm run dev

Backend scripts:
- cd fractal-backend
- npm install
- npx ts-node scripts/check-wiring.ts

## Security and secrets
- No private keys are committed. Do not add them to the repo.
- Frontend uses public RPC defaults; you can override via local .env for development only.
