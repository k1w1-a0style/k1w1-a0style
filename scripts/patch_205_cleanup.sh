#!/usr/bin/env bash
set -euo pipefail

# Patch 205 cleanup: remove known-dead legacy files (safe: only if present)
# Rationale: these files have 0 imports in current tree and were left behind during refactors.

DEAD_FILES=(
  "lib/supabaseTypes.ts"
  "screens/SettingsScreen/utils/keyMasking.ts"
  "shared/types/github.ts"
)

removed_any=0
for f in "${DEAD_FILES[@]}"; do
  if [ -f "$f" ]; then
    rm -f "$f"
    echo "removed: $f"
    removed_any=1
  fi
done

if [ "$removed_any" -eq 0 ]; then
  echo "Patch 205 cleanup: nothing to remove (already clean)."
else
  echo "Patch 205 cleanup done."
fi
