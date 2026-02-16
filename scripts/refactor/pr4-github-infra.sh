#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "infra/github/githubService.ts" ]; then
  echo "❌ Missing infra/github/githubService.ts (apply Patch 150)"
  exit 1
fi

if ! grep -q 'export \* from "\.\./infra/github/githubService"' contexts/githubService.ts; then
  echo "❌ contexts/githubService.ts is not a facade re-export"
  exit 1
fi

echo "✅ PR-4 stage 1 looks good (GitHub service moved to infra + facade present)."
