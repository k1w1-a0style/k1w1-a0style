#!/usr/bin/env bash
set -euo pipefail

PATCH_FILE="${1:-}"
if [ -z "$PATCH_FILE" ]; then
  echo "Usage: $0 <patch-file>" >&2
  exit 2
fi

if [ ! -f "$PATCH_FILE" ]; then
  echo "Patch file not found: $PATCH_FILE" >&2
  exit 2
fi

grep -q '^diff --git ' "$PATCH_FILE" || { echo "Missing diff headers"; exit 1; }
grep -q '^@@ ' "$PATCH_FILE" || { echo "Missing hunk headers"; exit 1; }

git apply --check "$PATCH_FILE"
echo "Patch artifact looks syntactically valid and applies cleanly."
