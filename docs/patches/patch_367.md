# Patch 367 — CI-Lite local env: Admin key + signing keys

## Why
Your `.env.local` only had `DATABASE_URL` (and it was duplicated). For CI-Lite terminal smoke tests + Edge Function calls you need a local `ADMIN_KEY` that matches the Supabase secret `SIGNING_ADMIN_KEY`.

Without it, calls like:
- `.../functions/v1/github-workflow-dispatch`
- `.../functions/v1/github-workflow-runs`
- `.../functions/v1/github-workflow-logs`

return `Unauthorized: missing or invalid admin credentials.`

## What changed
- Adds **`.env.ci-lite.local`** populated from your `a0style-Token.txt`:
  - `ADMIN_KEY`, `K1W1_EDGE_ADMIN_KEY`, `SIGNING_ADMIN_KEY`
  - `SIGNING_MASTER_KEY`
  - `SUPABASE_URL` (+ `K1W1_SUPABASE_URL`)
- Adds **`.env.ci-lite.example`** template
- Adds helper script **`scripts/ci-lite-env-load.sh`**

## Usage
```bash
# unzip patch and delete zip in one go
unzip -o <PATCH_ZIP>.zip && rm -f <PATCH_ZIP>.zip

# load env (exports variables into current shell)
./scripts/ci-lite-env-load.sh

# run CI-Lite smoke (dispatch -> poll -> logs)
chmod +x scripts/ci-lite-smoke.sh
./scripts/ci-lite-smoke.sh k1w1-a0style/musik-player k1w1-ci-lite-autofix.yml main
```
