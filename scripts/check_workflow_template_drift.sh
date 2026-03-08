#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

EDGE_FILE="supabase/functions/github-workflow-dispatch/index.ts"
INFRA_FILE="infra/github/workflowTemplates.ts"
DIAG_FILE="lib/diagnostics/workflowTemplates.ts"

[ -f "$EDGE_FILE" ] || fail "Missing edge workflow source: $EDGE_FILE"
[ -f "$INFRA_FILE" ] || fail "Missing infra workflow source: $INFRA_FILE"
[ -f "$DIAG_FILE" ] || fail "Missing diagnostics workflow source: $DIAG_FILE"

extract_version() {
  local file="$1"
  sed -n 's/^# workflow-version: //p' "$file" | head -n1
}

assert_managed_file() {
  local file="$1"
  [ -f "$file" ] || fail "Missing workflow file: $file"
  grep -q '^# managed-by: k1w1' "$file" || fail "Missing managed-by marker in $file"
  local v
  v="$(extract_version "$file")"
  [ -n "$v" ] || fail "Missing workflow-version in $file"
}

assert_managed_file .github/workflows/eas-build.yml
assert_managed_file .github/workflows/eas-link.yml
assert_managed_file .github/workflows/release-build.yml
assert_managed_file .github/workflows/k1w1-ci-lite.yml
assert_managed_file .github/workflows/k1w1-ci-lite-autofix.yml

EAS_VERSION="$(extract_version .github/workflows/eas-build.yml)"
for wf in .github/workflows/eas-link.yml .github/workflows/release-build.yml; do
  V="$(extract_version "$wf")"
  [ "$V" = "$EAS_VERSION" ] || fail "Workflow version drift in $wf (expected $EAS_VERSION, got ${V:-<empty>})"
done

grep -q '# managed-by: k1w1' "$DIAG_FILE" || fail "Diagnostics workflow templates missing managed-by marker"
grep -q "# workflow-version: $EAS_VERSION" "$DIAG_FILE" || fail "Diagnostics workflow templates missing workflow-version $EAS_VERSION"

CI_VERSION="$(extract_version .github/workflows/k1w1-ci-lite.yml)"
AF_VERSION="$(extract_version .github/workflows/k1w1-ci-lite-autofix.yml)"
[ "$CI_VERSION" = "$AF_VERSION" ] || fail "CI Lite workflow version drift between live workflows"

grep -q '"k1w1-ci-lite.yml": `' "$INFRA_FILE" || fail "Template source missing entry for k1w1-ci-lite.yml"
grep -q '"k1w1-ci-lite-autofix.yml": `' "$INFRA_FILE" || fail "Template source missing entry for k1w1-ci-lite-autofix.yml"
grep -q '# managed-by: k1w1' "$INFRA_FILE" || fail "Infra templates missing managed-by marker"
grep -q "# workflow-version: $CI_VERSION" "$INFRA_FILE" || fail "Infra templates missing workflow-version $CI_VERSION"
grep -q 'repository_dispatch:' "$INFRA_FILE" || fail "Infra CI Lite template missing repository_dispatch"
grep -q 'source_sha' "$INFRA_FILE" || fail "Infra CI Lite templates missing source_sha provenance"
grep -q 'expo preflight' "$INFRA_FILE" || fail "Infra CI Lite templates missing expo preflight"

grep -q '"k1w1-ci-lite.yml": `' "$EDGE_FILE" || fail "Edge templates missing entry for k1w1-ci-lite.yml"
grep -q '"k1w1-ci-lite-autofix.yml": `' "$EDGE_FILE" || fail "Edge templates missing entry for k1w1-ci-lite-autofix.yml"
grep -q '# managed-by: k1w1' "$EDGE_FILE" || fail "Edge templates missing managed-by marker"
grep -q "# workflow-version: $CI_VERSION" "$EDGE_FILE" || fail "Edge templates missing workflow-version $CI_VERSION"
grep -q 'repository_dispatch:' "$EDGE_FILE" || fail "Edge CI Lite template missing repository_dispatch"
grep -q 'source_sha' "$EDGE_FILE" || fail "Edge CI Lite templates missing source_sha provenance"
grep -q 'expo preflight' "$EDGE_FILE" || fail "Edge CI Lite templates missing expo preflight"

echo "Workflow template drift check passed."
