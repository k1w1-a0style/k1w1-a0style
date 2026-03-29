#!/usr/bin/env bash
set -euo pipefail

WF_EAS=".github/workflows/eas-build.yml"
WF_TRIGGERED=".github/workflows/k1w1-triggered-build.yml"
SHARED_EAS_RELEASE="shared/workflows/easBuildReleaseWorkflowTemplates.ts"
SHARED_TRIGGERED="shared/workflows/k1w1TriggeredBuildWorkflowTemplate.ts"
DIAG_TEMPLATES="lib/diagnostics/workflowTemplates.ts"

[ -f "$WF_EAS" ] || { echo "missing $WF_EAS" >&2; exit 1; }
[ -f "$WF_TRIGGERED" ] || { echo "missing $WF_TRIGGERED" >&2; exit 1; }
[ -f "$SHARED_EAS_RELEASE" ] || { echo "missing $SHARED_EAS_RELEASE" >&2; exit 1; }
[ -f "$SHARED_TRIGGERED" ] || { echo "missing $SHARED_TRIGGERED" >&2; exit 1; }
[ -f "$DIAG_TEMPLATES" ] || { echo "missing $DIAG_TEMPLATES" >&2; exit 1; }

# Live EAS reusable workflow contract.
grep -q "strict_lockfile:" "$WF_EAS"
grep -q "options: \[auto, \"true\", \"false\"\]" "$WF_EAS"
grep -q "Invalid strict_lockfile override" "$WF_EAS"
grep -q "Strict lockfile policy:" "$WF_EAS"

# Shared EAS/Release template SoT must carry the same controls.
grep -q "strict_lockfile:" "$SHARED_EAS_RELEASE"
grep -q "options: \[auto, \"true\", \"false\"\]" "$SHARED_EAS_RELEASE"
grep -q "Invalid strict_lockfile override" "$SHARED_EAS_RELEASE"
grep -q "Strict lockfile policy:" "$SHARED_EAS_RELEASE"

# Live triggered-build contract.
grep -q "strict_lockfile:" "$WF_TRIGGERED"
grep -q "autofix:" "$WF_TRIGGERED"
grep -q "inputs.strict_lockfile" "$WF_TRIGGERED"
grep -q "inputs.autofix" "$WF_TRIGGERED"

# Shared triggered-build template SoT must carry dispatch passthrough controls.
grep -q "strict_lockfile:" "$SHARED_TRIGGERED"
grep -q "autofix:" "$SHARED_TRIGGERED"
grep -q "inputs.strict_lockfile" "$SHARED_TRIGGERED"
grep -q "inputs.autofix" "$SHARED_TRIGGERED"

# Diagnostics layer must stay wired to shared template exports (not inline drift).
grep -q "WORKFLOW_EAS_BUILD_TEMPLATE" "$DIAG_TEMPLATES"
grep -q "WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE" "$DIAG_TEMPLATES"

echo "EAS manual trigger controls invariants passed."
