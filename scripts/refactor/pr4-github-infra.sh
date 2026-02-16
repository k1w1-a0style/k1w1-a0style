#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "infra/github/githubService.ts" ]; then
  echo "❌ Missing infra/github/githubService.ts (apply Patch 150+)"
  exit 1
fi

if ! grep -q 'export \* from "\.\./infra/github/githubService"' contexts/githubService.ts; then
  echo "❌ contexts/githubService.ts is not a facade re-export"
  exit 1
fi

# Stage 2 checks (optional)
modules=(
  "infra/github/tokenStore.ts"
  "infra/github/secrets.ts"
  "infra/github/repos.ts"
  "infra/github/files.ts"
  "infra/github/workflows.ts"
  "infra/github/crypto.ts"
  "infra/github/rateLimit.ts"
  "infra/github/utils.ts"
)

stage2_ok=true
for f in "${modules[@]}"; do
  if [ ! -f "$f" ]; then
    stage2_ok=false
    break
  fi
done

if [ "$stage2_ok" = true ]; then
  echo "✅ PR-4 stage 2 looks good (GitHub service split into modules + facade present)."
else
  echo "✅ PR-4 stage 1 looks good (GitHub service moved to infra + facade present)."
fi
