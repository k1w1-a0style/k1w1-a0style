#!/usr/bin/env bash
set -euo pipefail

echo "== PR-2: Storage move sanity check =="

if [ ! -f "infra/storage/projectPersistence.ts" ]; then
  echo "❌ Missing infra/storage/projectPersistence.ts (apply Patch 148+)"
  exit 1
fi

echo "✅ infra/storage/projectPersistence.ts present"

# Facade file existed in earlier patches; it was removed in PR-7 Stage 5.
if [ -f "contexts/projectStorage.ts" ]; then
  echo "⚠️  contexts/projectStorage.ts still exists (legacy branch)."
  echo "   Prefer importing from infra/storage/projectPersistence."
else
  echo "ℹ️  contexts/projectStorage.ts not present (expected after Patch 164)"
fi
