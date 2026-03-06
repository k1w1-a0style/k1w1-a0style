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

grep -q 'PROJECT_CHECKLOG.md' "$PATCH_FILE" || { echo "Patch must update PROJECT_CHECKLOG.md"; exit 1; }
grep -q 'docs/patches/PATCHLOG_ROOT.md' "$PATCH_FILE" || { echo "Patch must update docs/patches/PATCHLOG_ROOT.md"; exit 1; }
grep -Eq 'docs/patches/patch_[0-9]+\.md' "$PATCH_FILE" || { echo "Patch must include a docs/patches/patch_<num>.md note"; exit 1; }

if grep -Eq '(^|/)apply_patch_[0-9]+_direct\.sh' "$PATCH_FILE"; then
  echo "Patch must not ship temporary apply_patch_*_direct.sh helper files"
  exit 1
fi

if grep -Eq '\.(rej|orig)$' "$PATCH_FILE"; then
  echo "Patch must not contain .rej or .orig leftovers"
  exit 1
fi

git apply --check "$PATCH_FILE"
echo "Patch artifact looks syntactically valid, documented, and applies cleanly."
