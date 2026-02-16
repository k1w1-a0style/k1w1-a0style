#!/usr/bin/env bash
set -euo pipefail

echo "[PR-3] Polling consolidation check"

if [[ ! -f "project/services/buildPollingService.ts" ]]; then
  echo "❌ Missing: project/services/buildPollingService.ts"
  exit 1
fi

if ! grep -q "buildPollingService" "hooks/useBuildStatus.ts"; then
  echo "❌ hooks/useBuildStatus.ts does not reference buildPollingService"
  exit 1
fi

echo "✅ Looks good: buildPollingService exists and useBuildStatus references it."
