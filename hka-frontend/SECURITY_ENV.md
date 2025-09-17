# Environment & Secret Management

## Overview
The frontend previously contained a raw `PRIVATE_KEY` and direct RPC URLs in `.env`. These have been sanitized. Any exposed key MUST be rotated immediately.

## Do Not Commit
Add secrets only to:
- `.env.local` (gitignored)
- Backend service secret store (if applicable)

Never commit:
- Private keys
- Raw provider RPC URLs tied to billing
- Non-public API keys

## Recommended Layout
| File | Purpose | Committed |
|------|---------|-----------|
| .env | Non-sensitive defaults & contract addresses | Yes (sanitized) |
| .env.local | Developer specific / secrets | No |
| .env.security.example | Template for secret vars | Yes |

## Rotation Steps
1. Revoke/rotate the exposed private key in your wallet or key management system.
2. Deploy new contracts if that key was an owner or privileged actor.
3. Invalidate old RPC keys (Infura/Alchemy) if present.
4. Update `.env.local` with new values; keep `.env` generic.

## Frontend Exposure
Remember: Any `VITE_` prefixed variable is embedded into the client bundle. Treat them as public.

## Feature Flags
Add non-sensitive flags in `.env`:
```
VITE_DEBUG_DEX=false
FEATURE_CCPAYLOAD=false
```
Keep sensitive gating logic server-side when possible.

## Auditing Script (Optional)
You can scan for high-risk patterns:
```
rg "PRIVATE_KEY|ALCHEMY|INFURA|SECRET|API_KEY" -i
```
(Install ripgrep or adapt using grep.)

## Next Steps
- Ensure CI fails on accidental secret patterns (add a pre-commit hook or GitHub Action with secret scanning).
- Consider using environment-specific config fetched at runtime from a secure endpoint rather than embedding keys.
