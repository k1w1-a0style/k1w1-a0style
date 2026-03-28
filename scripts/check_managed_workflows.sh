#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

forbid_fixed() {
  local file="$1"
  local text="$2"
  if grep -Fq -- "$text" "$file"; then
    fail "Forbidden '$text' found in $file"
  fi
}

require_ref_input_required_true() {
  local file="$1"
  awk '
    /^on:[[:space:]]*$/ { in_on=1; next }
    in_on && /^[^[:space:]]/ { in_on=0 }

    in_on && /^[[:space:]]+workflow_dispatch:[[:space:]]*$/ { in_dispatch=1; dispatch_indent=match($0, /[^[:space:]]/) - 1; next }
    in_dispatch && /^[[:space:]]*$/ { next }
    in_dispatch {
      indent=match($0, /[^[:space:]]/) - 1
      if (indent <= dispatch_indent && $0 !~ /^[[:space:]]*#/) { in_dispatch=0 }
    }

    in_dispatch && /^[[:space:]]+inputs:[[:space:]]*$/ { in_inputs=1; inputs_indent=match($0, /[^[:space:]]/) - 1; next }
    in_inputs && /^[[:space:]]*$/ { next }
    in_inputs {
      indent=match($0, /[^[:space:]]/) - 1
      if (indent <= inputs_indent && $0 !~ /^[[:space:]]*#/) { in_inputs=0 }
    }

    in_inputs && /^[[:space:]]+ref:[[:space:]]*$/ { in_ref=1; ref_indent=match($0, /[^[:space:]]/) - 1; next }
    in_ref && /^[[:space:]]*$/ { next }
    in_ref {
      if ($0 ~ /^[[:space:]]+required:[[:space:]]*true[[:space:]]*$/) { found=1; exit }

      indent=match($0, /[^[:space:]]/) - 1
      if (indent <= ref_indent && $0 !~ /^[[:space:]]*#/) { in_ref=0 }
    }

    END { if (!found) exit 1 }
  ' "$file" || fail "Missing 'on.workflow_dispatch.inputs.ref.required: true' contract in $file"
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
SHARED_FILE="shared/workflows/managedWorkflowTemplates.ts"
[ -f "$EDGE_FILE" ] || fail "Missing edge workflow source: $EDGE_FILE"
[ -f "$SHARED_FILE" ] || fail "Missing shared workflow source: $SHARED_FILE"

grep -q 'managedWorkflowTemplates' "$EDGE_FILE" || fail "Edge dispatch must import shared managed workflow templates"
grep -q 'WORKFLOW_TEMPLATES' "$EDGE_FILE" || fail "Edge dispatch missing WORKFLOW_TEMPLATES reference"
grep -q 'function parseManagedWorkflowMeta' "$EDGE_FILE" || fail "Missing managed workflow metadata parser"

grep -q '# managed-by: k1w1' "$SHARED_FILE" || fail "Shared workflow templates missing managed-by marker"
version_count="$(grep -E -c '# workflow-version: [0-9]+' "$SHARED_FILE" || true)"
[ "${version_count:-0}" -ge 1 ] || fail "Shared workflow templates missing numeric workflow-version marker"

shared_max_version="$(grep -Eo '# workflow-version: [0-9]+' "$SHARED_FILE" | awk '{print $3}' | sort -n | tail -n1)"
[ -n "${shared_max_version:-}" ] || fail "Could not determine shared workflow-version"
if [ "$shared_max_version" -lt 399 ]; then
  fail "Shared workflow-version unexpectedly old: $shared_max_version"
fi

grep -q 'source_sha' "$SHARED_FILE" || fail "Shared workflow templates missing source_sha/source_commit_sha provenance"
grep -q 'repository_dispatch:' "$SHARED_FILE" || fail "Shared templates missing repository_dispatch support"

for wf in .github/workflows/eas-build.yml .github/workflows/eas-link.yml .github/workflows/release-build.yml .github/workflows/deploy-supabase-functions.yml .github/workflows/k1w1-triggered-build.yml; do
  grep -Eq '^\s+ref:\s*$' "$wf" || fail "Missing explicit ref input block in $wf"
  require_ref_input_required_true "$wf"
  forbid_fixed "$wf" 'ref: ${{ inputs.ref || github.ref }}'
  forbid_fixed "$wf" 'ref: ${{ inputs.ref || github.ref_name }}'
  forbid_fixed "$wf" 'ref: ${{ github.ref }}'
  forbid_fixed "$wf" 'ref: ${{ github.ref_name }}'
  forbid_fixed "$wf" 'github.head_ref'
  forbid_fixed "$wf" 'github.event.repository.default_branch'
done

grep -Fq "workflow_dispatch' && inputs.ref || github.ref" .github/workflows/ci.yml || fail "CI workflow lost documented branch-based CI-lite fallback contract"
grep -Fq 'default_ref: work' .github/workflows/k1w1-ci-lite.yml || fail "CI Lite workflow lost documented default_ref=work exception"

echo "Managed workflows look consistent."
