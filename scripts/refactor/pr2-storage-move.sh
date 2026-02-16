#!/usr/bin/env bash
set -euo pipefail

echo "PR-2 (Patch 148): storage move + facade"
if [[ -f "infra/storage/projectPersistence.ts" && -f "contexts/projectStorage.ts" ]]; then
  echo "✅ infra/storage/projectPersistence.ts exists"
  echo "✅ contexts/projectStorage.ts facade exists"
else
  echo "❌ Expected files not found. Did you apply Patch 148?"
  exit 1
fi

echo "Tip: run baseline checks:"
echo "  npm run typecheck"
echo "  npm run lint:ci"
echo "  npm run test:silent"
