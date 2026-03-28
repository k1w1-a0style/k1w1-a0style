#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

EDGE_FILE="supabase/functions/github-workflow-dispatch/index.ts"
INFRA_FILE="infra/github/workflowTemplates.ts"
SHARED_FILE="shared/workflows/managedWorkflowTemplates.ts"
EAS_LINK_SHARED_FILE="shared/workflows/easLinkWorkflowTemplate.ts"
DIAG_FILE="lib/diagnostics/workflowTemplates.ts"

[ -f "$EDGE_FILE" ] || fail "Missing edge workflow source: $EDGE_FILE"
[ -f "$INFRA_FILE" ] || fail "Missing infra workflow source: $INFRA_FILE"
[ -f "$SHARED_FILE" ] || fail "Missing shared workflow source: $SHARED_FILE"
[ -f "$EAS_LINK_SHARED_FILE" ] || fail "Missing shared EAS Link workflow source: $EAS_LINK_SHARED_FILE"
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
assert_managed_file .github/workflows/deploy-supabase-functions.yml

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

grep -q '"k1w1-ci-lite.yml": `' "$SHARED_FILE" || fail "Shared templates missing entry for k1w1-ci-lite.yml"
grep -q '"k1w1-ci-lite-autofix.yml": `' "$SHARED_FILE" || fail "Shared templates missing entry for k1w1-ci-lite-autofix.yml"
grep -q '# managed-by: k1w1' "$SHARED_FILE" || fail "Shared templates missing managed-by marker"
grep -q "# workflow-version: $CI_VERSION" "$SHARED_FILE" || fail "Shared templates missing workflow-version $CI_VERSION"
grep -q 'repository_dispatch:' "$SHARED_FILE" || fail "Shared CI Lite template missing repository_dispatch"
grep -q 'source_sha' "$SHARED_FILE" || fail "Shared CI Lite templates missing source_sha provenance"
grep -q 'expo preflight' "$SHARED_FILE" || fail "Shared CI Lite templates missing expo preflight"

grep -q 'managedWorkflowTemplates' "$INFRA_FILE" || fail "Infra templates must import shared managed templates"
grep -q 'WORKFLOW_TEMPLATES' "$INFRA_FILE" || fail "Infra templates missing WORKFLOW_TEMPLATES reference"
grep -q 'managedWorkflowTemplates' "$EDGE_FILE" || fail "Edge dispatch must import shared managed templates"
grep -q 'WORKFLOW_TEMPLATES' "$EDGE_FILE" || fail "Edge dispatch missing WORKFLOW_TEMPLATES reference"
grep -q 'WORKFLOW_EAS_LINK_TEMPLATE' "$DIAG_FILE" || fail "Diagnostics workflow templates must import WORKFLOW_EAS_LINK_TEMPLATE"
grep -q 'WORKFLOW_EAS_LINK = WORKFLOW_EAS_LINK_TEMPLATE' "$DIAG_FILE" || fail "Diagnostics EAS Link export must re-use shared template SoT"

grep -q 'package_manager=yarn' "$DIAG_FILE" || fail "Diagnostics templates missing yarn package-manager handling"
grep -q 'package_manager=pnpm' "$DIAG_FILE" || fail "Diagnostics templates missing pnpm package-manager handling"
grep -q 'yarn install --frozen-lockfile' "$DIAG_FILE" || fail "Diagnostics templates missing yarn install path"
grep -q 'pnpm install --frozen-lockfile' "$DIAG_FILE" || fail "Diagnostics templates missing pnpm install path"
grep -q 'github.event.client_payload.autofix' "$DIAG_FILE" || fail "Diagnostics templates missing repository_dispatch autofix passthrough"
grep -q 'github.event.client_payload.strict_lockfile' "$DIAG_FILE" || fail "Diagnostics templates missing repository_dispatch strict_lockfile passthrough"

grep -q 'package_manager' .github/workflows/k1w1-ci-lite.yml || fail "Live CI Lite missing package_manager metadata"
grep -q 'package_manager' .github/workflows/k1w1-ci-lite-autofix.yml || fail "Live CI Lite Autofix missing package_manager metadata"
grep -q 'package_manager' "$SHARED_FILE" || fail "Shared templates missing package_manager metadata"
grep -q 'yarn install --immutable' .github/workflows/k1w1-ci-lite.yml || fail "Live CI Lite missing yarn install path"
grep -q 'pnpm install --frozen-lockfile' .github/workflows/k1w1-ci-lite.yml || fail "Live CI Lite missing pnpm install path"
grep -q 'yarn install --immutable' .github/workflows/k1w1-ci-lite-autofix.yml || fail "Live CI Lite Autofix missing yarn install path"
grep -q 'pnpm install --frozen-lockfile' .github/workflows/k1w1-ci-lite-autofix.yml || fail "Live CI Lite Autofix missing pnpm install path"
grep -q 'yarn install --immutable' "$SHARED_FILE" || fail "Shared templates missing yarn install path"
grep -q 'pnpm install --frozen-lockfile' "$SHARED_FILE" || fail "Shared templates missing pnpm install path"

grep -q 'Auto-fix writeback currently supports npm-managed repos only' .github/workflows/eas-build.yml || fail "Live EAS workflow missing non-npm autofix guard"
grep -q 'Auto-fix writeback currently supports npm-managed repos only' "$DIAG_FILE" || fail "Diagnostics templates missing non-npm autofix guard"


grep -q 'android-keystore-export' .github/workflows/eas-build.yml || fail "Live EAS workflow missing android-keystore-export endpoint"
grep -q 'android-keystore-export' .github/workflows/release-build.yml || fail "Release workflow missing android-keystore-export endpoint"
grep -q 'android-keystore-export' "$DIAG_FILE" || fail "Diagnostics templates missing android-keystore-export endpoint"
grep -q 'workflow version:' .github/workflows/deploy-supabase-functions.yml || fail "Supabase deploy summary missing workflow version line"
grep -q 'workflow version:' .github/workflows/eas-link.yml || fail "EAS Link summary missing workflow version line"
grep -q 'workflow version:' .github/workflows/release-build.yml || fail "Release Build summary missing workflow version line"

node <<'NODE'
const fs = require('fs');

const live = fs.readFileSync('.github/workflows/eas-link.yml', 'utf8').replace(/\r\n/g, '\n');
const diag = fs.readFileSync('lib/diagnostics/workflowTemplates.ts', 'utf8');
const shared = fs.readFileSync('shared/workflows/easLinkWorkflowTemplate.ts', 'utf8');
const base = JSON.parse(fs.readFileSync('templates/expo-sdk54-base.json', 'utf8'));

const sharedMatch = shared.match(/export const WORKFLOW_EAS_LINK_TEMPLATE = ('(?:\\.|[^'])*'|`(?:\\.|[^`])*`);/s);
if (!sharedMatch) {
  console.error('[FAIL] Shared EAS Link workflow template missing parsable WORKFLOW_EAS_LINK_TEMPLATE export');
  process.exit(1);
}

let sharedValue;
try {
  sharedValue = Function(`return (${sharedMatch[1]});`)();
} catch (err) {
  console.error('[FAIL] Shared WORKFLOW_EAS_LINK_TEMPLATE export is not a valid JS string literal');
  process.exit(1);
}

if (!diag.includes('export const WORKFLOW_EAS_LINK = WORKFLOW_EAS_LINK_TEMPLATE;')) {
  console.error('[FAIL] Diagnostics WORKFLOW_EAS_LINK export is not wired to WORKFLOW_EAS_LINK_TEMPLATE');
  process.exit(1);
}

const baseEntry = base.find((entry) => entry.path === '.github/workflows/eas-link.yml');
if (!baseEntry) {
  console.error('[FAIL] Base template JSON missing .github/workflows/eas-link.yml entry');
  process.exit(1);
}

if (sharedValue.replace(/\r\n/g, '\n') !== live) {
  console.error('[FAIL] Shared WORKFLOW_EAS_LINK_TEMPLATE drifted from live .github/workflows/eas-link.yml');
  process.exit(1);
}

if (String(baseEntry.content).replace(/\r\n/g, '\n') !== live) {
  console.error('[FAIL] templates/expo-sdk54-base.json EAS Link entry drifted from live .github/workflows/eas-link.yml');
  process.exit(1);
}
NODE

echo "Workflow template drift check passed."
