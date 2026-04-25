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

if rg -n --glob '*.yml' 'pull_request_target:' .github/workflows >/dev/null 2>&1; then
  fail "pull_request_target is forbidden for managed workflows unless explicitly re-approved"
fi

for wf in .github/workflows/*.yml; do
  if grep -Fq 'contents: write' "$wf"; then
    if grep -Eq '^[[:space:]]+pull_request:[[:space:]]*$|^[[:space:]]+pull_request_target:[[:space:]]*$' "$wf"; then
      fail "Workflow with contents: write must not be triggered by pull_request/pull_request_target: $wf"
    fi
  fi
done

LIVE_VERSION="$(sed -n 's/^# workflow-version: //p' .github/workflows/eas-build.yml | head -n1)"
[ -n "${LIVE_VERSION:-}" ] || fail "Could not determine live workflow version from eas-build.yml"
for wf in .github/workflows/eas-link.yml .github/workflows/release-build.yml .github/workflows/deploy-supabase-functions.yml; do
  V="$(sed -n 's/^# workflow-version: //p' "$wf" | head -n1)"
  [ "$V" = "$LIVE_VERSION" ] || fail "Managed workflow version drift in $wf (expected $LIVE_VERSION, got ${V:-<empty>})"
done

EDGE_FILE="supabase/functions/github-workflow-dispatch/index.ts"
SHARED_FILE="shared/workflows/managedWorkflowTemplates.ts"
CI_LITE_TEMPLATE_FILE="shared/workflows/templates/ciLiteTemplate.ts"
CI_LITE_AUTOFIX_TEMPLATE_FILE="shared/workflows/templates/ciLiteAutofixTemplate.ts"
DIAGNOSTICS_TEMPLATE_FILE="shared/workflows/templates/k1w1DiagnosticsTemplate.ts"
EAS_LINK_SHARED_FILE="shared/workflows/easLinkWorkflowTemplate.ts"
EAS_BUILD_RELEASE_SHARED_FILE="shared/workflows/easBuildReleaseWorkflowTemplates.ts"
TRIGGERED_BUILD_SHARED_FILE="shared/workflows/k1w1TriggeredBuildWorkflowTemplate.ts"
[ -f "$EDGE_FILE" ] || fail "Missing edge workflow source: $EDGE_FILE"
[ -f "$SHARED_FILE" ] || fail "Missing shared workflow source: $SHARED_FILE"
[ -f "$CI_LITE_TEMPLATE_FILE" ] || fail "Missing shared CI Lite template source: $CI_LITE_TEMPLATE_FILE"
[ -f "$CI_LITE_AUTOFIX_TEMPLATE_FILE" ] || fail "Missing shared CI Lite autofix template source: $CI_LITE_AUTOFIX_TEMPLATE_FILE"
[ -f "$DIAGNOSTICS_TEMPLATE_FILE" ] || fail "Missing shared diagnostics template source: $DIAGNOSTICS_TEMPLATE_FILE"
[ -f "$EAS_LINK_SHARED_FILE" ] || fail "Missing shared EAS Link workflow source: $EAS_LINK_SHARED_FILE"
[ -f "$EAS_BUILD_RELEASE_SHARED_FILE" ] || fail "Missing shared EAS/Release workflow source: $EAS_BUILD_RELEASE_SHARED_FILE"
[ -f "$TRIGGERED_BUILD_SHARED_FILE" ] || fail "Missing shared triggered-build workflow source: $TRIGGERED_BUILD_SHARED_FILE"

grep -q 'code: "missing_workflow"' "$EDGE_FILE" || fail "Edge dispatch must return missing_workflow contract"
grep -q 'Dispatch is mutation-free' "$EDGE_FILE" || fail "Edge dispatch must document mutation-free dispatch contract"
if grep -q 'managedWorkflowTemplates' "$EDGE_FILE"; then
  fail "Edge dispatch must not import managed workflow templates for implicit bootstrap anymore"
fi
if grep -q 'WORKFLOW_TEMPLATES' "$EDGE_FILE"; then
  fail "Edge dispatch must not keep implicit bootstrap template map references"
fi
grep -q '# managed-by: k1w1' "$CI_LITE_TEMPLATE_FILE" || fail "Shared CI Lite template missing managed-by marker"
grep -q '# managed-by: k1w1' "$CI_LITE_AUTOFIX_TEMPLATE_FILE" || fail "Shared CI Lite autofix template missing managed-by marker"
version_count="$(grep -E -c '# workflow-version: [0-9]+' "$CI_LITE_TEMPLATE_FILE" || true)"
[ "${version_count:-0}" -ge 1 ] || fail "Shared workflow templates missing numeric workflow-version marker"

shared_max_version="$(grep -Eo '# workflow-version: [0-9]+' "$CI_LITE_TEMPLATE_FILE" "$CI_LITE_AUTOFIX_TEMPLATE_FILE" | awk '{print $3}' | sort -n | tail -n1)"
[ -n "${shared_max_version:-}" ] || fail "Could not determine shared workflow-version"
if [ "$shared_max_version" -lt 399 ]; then
  fail "Shared workflow-version unexpectedly old: $shared_max_version"
fi

grep -q 'source_sha' "$CI_LITE_TEMPLATE_FILE" || fail "Shared CI Lite template missing source_sha/source_commit_sha provenance"
grep -q 'source_sha' "$CI_LITE_AUTOFIX_TEMPLATE_FILE" || fail "Shared CI Lite autofix template missing source_sha/source_commit_sha provenance"
grep -q 'repository_dispatch:' "$CI_LITE_TEMPLATE_FILE" || fail "Shared CI Lite template missing repository_dispatch support"
grep -q 'WORKFLOW_EAS_LINK_TEMPLATE' "$EAS_LINK_SHARED_FILE" || fail "Shared EAS Link workflow file missing WORKFLOW_EAS_LINK_TEMPLATE export"
grep -q '^# managed-by: k1w1' .github/workflows/eas-link.yml || fail "Live EAS Link workflow missing managed-by marker"
grep -q '^# workflow-version: ' .github/workflows/eas-link.yml || fail "Live EAS Link workflow missing workflow-version marker"
grep -q 'WORKFLOW_EAS_LINK_TEMPLATE' lib/diagnostics/workflowTemplates.ts || fail "Diagnostics templates must import WORKFLOW_EAS_LINK_TEMPLATE"
grep -q 'WORKFLOW_EAS_BUILD_TEMPLATE' lib/diagnostics/workflowTemplates.ts || fail "Diagnostics templates must import WORKFLOW_EAS_BUILD_TEMPLATE"
grep -q 'WORKFLOW_RELEASE_BUILD_TEMPLATE' lib/diagnostics/workflowTemplates.ts || fail "Diagnostics templates must import WORKFLOW_RELEASE_BUILD_TEMPLATE"
grep -q 'WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE' lib/diagnostics/workflowTemplates.ts || fail "Diagnostics templates must import WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE"
grep -q 'WORKFLOW_EAS_LINK = WORKFLOW_EAS_LINK_TEMPLATE' lib/diagnostics/workflowTemplates.ts || fail "Diagnostics EAS Link template must be sourced from shared template"
grep -q 'WORKFLOW_EAS_BUILD = WORKFLOW_EAS_BUILD_TEMPLATE' lib/diagnostics/workflowTemplates.ts || fail "Diagnostics EAS build template must be sourced from shared template"
grep -q 'WORKFLOW_RELEASE_BUILD = WORKFLOW_RELEASE_BUILD_TEMPLATE' lib/diagnostics/workflowTemplates.ts || fail "Diagnostics release template must be sourced from shared template"
grep -q 'WORKFLOW_K1W1_TRIGGERED_BUILD = WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE' lib/diagnostics/workflowTemplates.ts || fail "Diagnostics triggered-build template must be sourced from shared template"

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
grep -Fq 'default_ref: ""' .github/workflows/k1w1-ci-lite.yml || fail "CI Lite workflow must not keep implicit default_ref fallback"
forbid_fixed .github/workflows/k1w1-ci-lite.yml "github.event_name == 'repository_dispatch' && '' || github.ref_name"
grep -Fq "github.event_name != 'repository_dispatch' && github.ref_name || ''" .github/workflows/k1w1-ci-lite.yml || fail "CI Lite workflow must block repository_dispatch github.ref_name fallthrough"
forbid_fixed .github/workflows/k1w1-ci-lite.yml "github.event.client_payload.branch || github.event.client_payload.ref || inputs.ref || github.ref_name"
forbid_fixed .github/workflows/k1w1-ci-lite.yml "k1w1-ci-lite-\${{ github.event.client_payload.branch || github.event.client_payload.ref || inputs.ref || github.ref_name }}"
grep -Fq "github.event_name == 'repository_dispatch' && (github.event.client_payload.branch || github.event.client_payload.ref || 'missing-ref') || (inputs.ref || 'missing-ref')" .github/workflows/k1w1-ci-lite.yml || fail "CI Lite metadata must be explicit and must not imply github.ref_name fallback"
grep -Fq 'permissions:' .github/workflows/k1w1-ci-lite-autofix.yml || fail "CI Lite Autofix workflow missing permissions block"
grep -Fq 'contents: read' .github/workflows/k1w1-ci-lite-autofix.yml || fail "CI Lite Autofix workflow top-level permissions must remain contents: read"
grep -Fq 'jobs:' .github/workflows/k1w1-ci-lite-autofix.yml || fail "CI Lite Autofix workflow missing jobs block"
grep -Fq '    permissions:' .github/workflows/k1w1-ci-lite-autofix.yml || fail "CI Lite Autofix workflow missing job-level permissions"
grep -Fq '      contents: write' .github/workflows/k1w1-ci-lite-autofix.yml || fail "CI Lite Autofix writeback job must explicitly request contents: write"


node <<'NODE'
const fs = require('fs');

const liveEas = fs.readFileSync('.github/workflows/eas-build.yml', 'utf8').replace(/\r\n/g, '\n');
const liveRelease = fs.readFileSync('.github/workflows/release-build.yml', 'utf8').replace(/\r\n/g, '\n');
const sharedSrc = fs.readFileSync('shared/workflows/easBuildReleaseWorkflowTemplates.ts', 'utf8');
const sharedTriggeredSrc = fs.readFileSync('shared/workflows/k1w1TriggeredBuildWorkflowTemplate.ts', 'utf8');
const liveTriggered = fs.readFileSync('.github/workflows/k1w1-triggered-build.yml', 'utf8').replace(/\r\n/g, '\n');

const easMatch = sharedSrc.match(/export const WORKFLOW_EAS_BUILD_TEMPLATE = ('(?:\\.|[^'])*'|`(?:\\.|[^`])*`);/s);
const releaseMatch = sharedSrc.match(/export const WORKFLOW_RELEASE_BUILD_TEMPLATE = ('(?:\\.|[^'])*'|`(?:\\.|[^`])*`);/s);
if (!easMatch || !releaseMatch) {
  console.error('[FAIL] Shared EAS/Release workflow template exports are missing or unparsable');
  process.exit(1);
}

const sharedEas = Function(`return (${easMatch[1]});`)().replace(/\r\n/g, '\n');
const sharedRelease = Function(`return (${releaseMatch[1]});`)().replace(/\r\n/g, '\n');

if (sharedEas !== liveEas) {
  console.error('[FAIL] Shared EAS build template drifted from live .github/workflows/eas-build.yml');
  process.exit(1);
}

if (sharedRelease !== liveRelease) {
  console.error('[FAIL] Shared release build template drifted from live .github/workflows/release-build.yml');
  process.exit(1);
}

const triggeredMatch = sharedTriggeredSrc.match(/export const WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE = ('(?:\\.|[^'])*'|`(?:\\.|[^`])*`);/s);
if (!triggeredMatch) {
  console.error('[FAIL] Shared triggered-build workflow template export missing or unparsable');
  process.exit(1);
}

const sharedTriggered = Function(`return (${triggeredMatch[1]});`)().replace(/\r\n/g, '\n');
if (sharedTriggered !== liveTriggered) {
  console.error('[FAIL] Shared triggered-build template drifted from live .github/workflows/k1w1-triggered-build.yml');
  process.exit(1);
}
NODE

echo "Managed workflows look consistent."
