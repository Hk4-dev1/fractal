#!/usr/bin/env bash
set -euo pipefail

# This script sets GitHub Actions repo secrets for RPC URLs
# by reading your local hka-frontend/.env. Requires GitHub CLI (gh) authenticated.
# Usage: ./scripts/set-gh-secrets-from-env.sh <owner>/<repo>

REPO_SLUG="${1:-}"
if [[ -z "$REPO_SLUG" ]]; then
  echo "Usage: $0 <owner>/<repo>"
  exit 1
fi

ENV_FILE="hka-frontend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found."
  exit 1
fi

# Extract values from .env
get_env() {
  local key="$1"
  # Grep the line, cut after '=', trim quotes
  local val
  val=$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//") || true
  echo -n "$val"
}

ETH_URL=$(get_env VITE_RPC_ETHEREUM_SEPOLIA)
ARB_URL=$(get_env VITE_RPC_ARBITRUM_SEPOLIA)
OP_URL=$(get_env VITE_RPC_OPTIMISM_SEPOLIA)
BASE_URL=$(get_env VITE_RPC_BASE_SEPOLIA)

# Fallback to non-VITE keys if present
if [[ -z "$ETH_URL" ]]; then ETH_URL=$(get_env RPC_ETHEREUM_SEPOLIA); fi
if [[ -z "$ARB_URL" ]]; then ARB_URL=$(get_env RPC_ARBITRUM_SEPOLIA); fi
if [[ -z "$OP_URL" ]]; then OP_URL=$(get_env RPC_OPTIMISM_SEPOLIA); fi
if [[ -z "$BASE_URL" ]]; then BASE_URL=$(get_env RPC_BASE_SEPOLIA); fi

# Validate
missing=()
[[ -z "$ETH_URL" ]] && missing+=(ETH_SEPOLIA_RPC_URL)
[[ -z "$ARB_URL" ]] && missing+=(ARB_SEPOLIA_RPC_URL)
[[ -z "$OP_URL" ]] && missing+=(OP_SEPOLIA_RPC_URL)
[[ -z "$BASE_URL" ]] && missing+=(BASE_SEPOLIA_RPC_URL)
if (( ${#missing[@]} > 0 )); then
  echo "Missing URLs for: ${missing[*]}" >&2
  echo "Fill VITE_RPC_* or RPC_* in $ENV_FILE and rerun." >&2
  exit 1
fi

# Set secrets with gh CLI
set_secret() {
  local name="$1"; shift
  local value="$1"; shift || true
  echo "Setting secret $name"
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO_SLUG" --body-file - >/dev/null
}

set_secret ETH_SEPOLIA_RPC_URL "$ETH_URL"
set_secret ARB_SEPOLIA_RPC_URL "$ARB_URL"
set_secret OP_SEPOLIA_RPC_URL "$OP_URL"
set_secret BASE_SEPOLIA_RPC_URL "$BASE_URL"

echo "All secrets set on $REPO_SLUG."
