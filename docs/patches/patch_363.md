# Patch 363 — CI Lite local env + terminal smoke script

## Why
Your terminal calls to Supabase Edge Functions were failing with:
- `Unauthorized: missing or invalid admin credentials.`

That happened because `.env.ci-lite.local` didn’t include an admin key, so `ADMIN_KEY` / `K1W1_EDGE_ADMIN_KEY` were empty.

## What changed
- Add/overwrite `.env.ci-lite.local` with:
  - `SUPABASE_URL` / `K1W1_SUPABASE_URL`
  - `ADMIN_KEY` / `K1W1_EDGE_ADMIN_KEY` (from your provided token file; maps to `SIGNING_ADMIN_KEY`)
- Add `scripts/ci-lite-smoke.sh` to test the full CI Lite dispatch → runs → logs loop from terminal.

## How to use
```bash
unzip -o k1w1-a0style_patch_363_env_adminkey_smoke.zip && rm -f k1w1-a0style_patch_363_env_adminkey_smoke.zip
chmod +x scripts/ci-lite-smoke.sh
./scripts/ci-lite-smoke.sh k1w1-a0style/musik-player k1w1-ci-lite-autofix.yml main
```

## Notes
- `.env.ci-lite.local` is **local-only** and must stay uncommitted.
