#!/usr/bin/env bash
set -euo pipefail

# Patch 196 cleanup: remove confirmed-unused files.
# Safe to run multiple times.

FILES=(
  "lib/previewBuild.ts"
  "screens/CodeScreen/useCodeScreen.ts"
  "screens/TerminalScreen/TerminalScreen.tsx"
)

removed_any=false
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    rm -f "$f"
    echo "removed: $f"
    removed_any=true
  else
    echo "skip (missing): $f"
  fi
done

# Ensure scripts are executable if the repo tracks it.
# (If your FS doesn't preserve exec bit via zip, just run: chmod +x scripts/patch_196_cleanup.sh)

echo "Patch 196 cleanup done."
