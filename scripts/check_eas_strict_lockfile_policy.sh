#!/usr/bin/env bash
set -euo pipefail

WF=".github/workflows/eas-build.yml"
TPL="lib/diagnostics/workflowTemplates.ts"

[ -f "$WF" ] || { echo "missing $WF" >&2; exit 1; }
[ -f "$TPL" ] || { echo "missing $TPL" >&2; exit 1; }

grep -Fq 'Determine strict lockfile policy' "$WF" || { echo "workflow missing strict lockfile policy step" >&2; exit 1; }
grep -Fq 'Strict lockfile policy enabled for profile' "$WF" || { echo "workflow missing strict lockfile error" >&2; exit 1; }
grep -Fq 'Development profile allows fallback to npm install' "$WF" || { echo "workflow missing development fallback note" >&2; exit 1; }
grep -Fq 'Strict lockfile policy: ${{ steps.strict_lock.outputs.strict }}' "$WF" || { echo "workflow summary missing strict lockfile line" >&2; exit 1; }

grep -Fq 'Determine strict lockfile policy' "$TPL" || { echo "template missing strict lockfile policy step" >&2; exit 1; }
grep -Fq 'Strict lockfile policy enabled for profile' "$TPL" || { echo "template missing strict lockfile error" >&2; exit 1; }
grep -Fq 'Strict lockfile policy: ${{ steps.strict_lock.outputs.strict }}' "$TPL" || { echo "template summary missing strict lockfile line" >&2; exit 1; }

echo "EAS strict lockfile policy invariants passed."
