#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

check_file_markers() {
  local file="$1"
  [ -f "$file" ] || fail "Missing file: $file"
  grep -q '^# managed-by: k1w1' "$file" || fail "Missing managed-by marker in $file"
  grep -q '^# workflow-version: ' "$file" || fail "Missing workflow-version marker in $file"
}

check_file_markers ".github/workflows/eas-build.yml"
check_file_markers ".github/workflows/eas-link.yml"
check_file_markers ".github/workflows/release-build.yml"

EDGE_FILE="supabase/functions/github-workflow-dispatch/index.ts"
[ -f "$EDGE_FILE" ] || fail "Missing edge workflow source: $EDGE_FILE"

grep -q '# managed-by: k1w1' "$EDGE_FILE" || fail "Embedded workflow templates missing managed-by marker"
grep -q '# workflow-version: 4' "$EDGE_FILE" || fail "Embedded workflow templates missing workflow-version marker"
grep -q '"source_commit_sha": "${SOURCE_COMMIT_SHA:-}"' "$EDGE_FILE" || fail "Embedded workflow templates missing source_commit_sha"
grep -q 'function parseManagedWorkflowMeta' "$EDGE_FILE" || fail "Missing managed workflow metadata parser"

echo "Managed workflows look consistent."
