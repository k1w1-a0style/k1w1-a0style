#!/usr/bin/env bash
set -euo pipefail

echo "== PR-4: GitHub infra migration sanity check =="

if [ ! -f "infra/github/githubService.ts" ]; then
  echo "❌ Missing infra/github/githubService.ts (apply Patch 150+)"
  exit 1
fi

echo "✅ infra/github/githubService.ts present"

# Facade file existed in earlier patches; it was removed in PR-7 Stage 5.
if [ -f "contexts/githubService.ts" ]; then
  if grep -q 'export \* from "\.\./infra/github/githubService"' "contexts/githubService.ts"; then
    echo "✅ contexts/githubService.ts facade present (legacy branch)"
  else
    echo "❌ contexts/githubService.ts exists but is not a facade re-export"
    exit 1
  fi
else
  echo "ℹ️  contexts/githubService.ts not present (expected after Patch 164)"
fi

# Optional: module split check (PR-4 Stage 2)
MODULES=(
  "infra/github/crypto.ts"
  "infra/github/files.ts"
  "infra/github/repos.ts"
  "infra/github/secrets.ts"
  "infra/github/tokenStore.ts"
  "infra/github/utils.ts"
  "infra/github/workflows.ts"
  "infra/github/rateLimit.ts"
)

missing=0
for f in "${MODULES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "⚠️  Missing module: $f"
    missing=1
  fi
done

if [ "$missing" -eq 0 ]; then
  echo "✅ GitHub infra modules present"
else
  echo "ℹ️  Some modules are missing; this check is informational (depends on patch stage)."
fi
