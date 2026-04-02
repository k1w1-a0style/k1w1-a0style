#!/usr/bin/env bash
set -euo pipefail

WF=".github/workflows/eas-build.yml"
SHARED_TPL="shared/workflows/easBuildReleaseWorkflowTemplates.ts"
DIAG_TPL="lib/diagnostics/workflowTemplates.ts"

[ -f "$WF" ] || { echo "missing $WF" >&2; exit 1; }
[ -f "$SHARED_TPL" ] || { echo "missing $SHARED_TPL" >&2; exit 1; }
[ -f "$DIAG_TPL" ] || { echo "missing $DIAG_TPL" >&2; exit 1; }

grep -Fq 'Determine strict lockfile policy' "$WF" || { echo "workflow missing strict lockfile policy step" >&2; exit 1; }
grep -Fq 'Strict lockfile policy enabled for profile' "$WF" || { echo "workflow missing strict lockfile error" >&2; exit 1; }
grep -Fq 'Development profile allows fallback to npm install' "$WF" || { echo "workflow missing development fallback note" >&2; exit 1; }
grep -Fq 'Strict lockfile policy: ${{ steps.strict_lock.outputs.strict }}' "$WF" || { echo "workflow summary missing strict lockfile line" >&2; exit 1; }

grep -Fq 'Determine strict lockfile policy' "$SHARED_TPL" || { echo "shared template missing strict lockfile policy step" >&2; exit 1; }
grep -Fq 'Strict lockfile policy enabled for profile' "$SHARED_TPL" || { echo "shared template missing strict lockfile error" >&2; exit 1; }
grep -Fq 'Strict lockfile policy: ${{ steps.strict_lock.outputs.strict }}' "$SHARED_TPL" || { echo "shared template summary missing strict lockfile line" >&2; exit 1; }

grep -Fq 'WORKFLOW_EAS_BUILD_TEMPLATE' "$DIAG_TPL" || { echo "diagnostics template wiring missing WORKFLOW_EAS_BUILD_TEMPLATE" >&2; exit 1; }
grep -Fq 'export const WORKFLOW_EAS_BUILD = WORKFLOW_EAS_BUILD_TEMPLATE;' "$DIAG_TPL" || { echo "diagnostics EAS build export drifted from shared template SoT" >&2; exit 1; }

echo "EAS strict lockfile policy invariants passed."
