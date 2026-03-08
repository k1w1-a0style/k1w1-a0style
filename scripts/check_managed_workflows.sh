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
check_file_markers ".github/workflows/deploy-supabase-functions.yml"

LIVE_VERSION="$(sed -n 's/^# workflow-version: //p' .github/workflows/eas-build.yml | head -n1)"
[ -n "${LIVE_VERSION:-}" ] || fail "Could not determine live workflow version from eas-build.yml"
for wf in .github/workflows/eas-link.yml .github/workflows/release-build.yml .github/workflows/deploy-supabase-functions.yml; do
  V="$(sed -n 's/^# workflow-version: //p' "$wf" | head -n1)"
  [ "$V" = "$LIVE_VERSION" ] || fail "Managed workflow version drift in $wf (expected $LIVE_VERSION, got ${V:-<empty>})"
done

EDGE_FILE="supabase/functions/github-workflow-dispatch/index.ts"
[ -f "$EDGE_FILE" ] || fail "Missing edge workflow source: $EDGE_FILE"

managed_count="$(grep -c '# managed-by: k1w1' "$EDGE_FILE" || true)"
[ "${managed_count:-0}" -ge 1 ] || fail "Embedded workflow templates missing managed-by marker"

version_count="$(grep -E -c '# workflow-version: [0-9]+' "$EDGE_FILE" || true)"
[ "${version_count:-0}" -ge 1 ] || fail "Embedded workflow templates missing numeric workflow-version marker"

embedded_max_version="$(grep -Eo '# workflow-version: [0-9]+' "$EDGE_FILE" | awk '{print $3}' | sort -n | tail -n1)"
[ -n "${embedded_max_version:-}" ] || fail "Could not determine embedded workflow-version"
if [ "$embedded_max_version" -lt 399 ]; then
  fail "Embedded workflow-version unexpectedly old: $embedded_max_version"
fi

grep -q 'source_sha' "$EDGE_FILE" || fail "Embedded workflow templates missing source_sha/source_commit_sha provenance"
grep -q 'function parseManagedWorkflowMeta' "$EDGE_FILE" || fail "Missing managed workflow metadata parser"
grep -q 'repository_dispatch:' "$EDGE_FILE" || fail "Embedded templates missing repository_dispatch support"

echo "Managed workflows look consistent."
