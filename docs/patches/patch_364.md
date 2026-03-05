# Patch 364 — CI Lite smoke script: fix invalid JSON + sturdier polling

## Why
The previous `scripts/ci-lite-smoke.sh` could send malformed JSON to the Edge Functions (bash quoting issue),
triggering:

- `Invalid JSON: Expected property name ...`

That prevented terminal-based preflight testing of the in-app CI Lite flow.

## What changed
- Rebuild request payloads using `jq -nc` (no manual quoting).
- Use `--data-binary` to preserve payload exactly.
- Add retries for fetching a newly created run ID.
- Print a compact status summary and return non‑zero when a completed run is not `success`.

## How to use

```bash
# load env for this terminal session
set -a && source ./.env.ci-lite.local && set +a

# dispatch -> runs -> logs
chmod +x scripts/ci-lite-smoke.sh
./scripts/ci-lite-smoke.sh k1w1-a0style/musik-player k1w1-ci-lite-autofix.yml main
```
