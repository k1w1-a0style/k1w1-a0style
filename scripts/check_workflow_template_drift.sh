#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

EDGE_FILE="supabase/functions/github-workflow-dispatch/index.ts"
[ -f "$EDGE_FILE" ] || fail "Missing edge workflow source: $EDGE_FILE"

extract_version() {
  local file="$1"
  sed -n 's/^# workflow-version: //p' "$file" | head -n1
}

BASE_VERSION="$(extract_version .github/workflows/eas-build.yml)"
[ -n "$BASE_VERSION" ] || fail "Could not read workflow-version from eas-build.yml"

for wf in .github/workflows/eas-build.yml .github/workflows/eas-link.yml .github/workflows/release-build.yml; do
  [ -f "$wf" ] || fail "Missing workflow file: $wf"
  grep -q '^# managed-by: k1w1' "$wf" || fail "Missing managed-by marker in $wf"
  V="$(extract_version "$wf")"
  [ "$V" = "$BASE_VERSION" ] || fail "Workflow version drift in $wf (expected $BASE_VERSION, got ${V:-<empty>})"
done

grep -q '# managed-by: k1w1' "$EDGE_FILE" || fail "Embedded templates missing managed-by marker"
grep -q "# workflow-version: $BASE_VERSION" "$EDGE_FILE" || fail "Embedded templates missing workflow-version $BASE_VERSION"

grep -q 'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4' "$EDGE_FILE" || fail "Embedded templates missing pinned actions/checkout"
grep -q 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4' "$EDGE_FILE" || fail "Embedded templates missing pinned actions/setup-node"
grep -q 'actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb0d8b62a3 # v4' "$EDGE_FILE" || fail "Embedded templates missing pinned actions/upload-artifact"
grep -q '"source_commit_sha": "${SOURCE_COMMIT_SHA:-}"' "$EDGE_FILE" || fail "Embedded templates missing source_commit_sha"

echo "Workflow template drift check passed."
