#!/usr/bin/env bash
set -euo pipefail

grep -q "strict_lockfile:" .github/workflows/eas-build.yml
grep -q "options: \[auto, \"true\", \"false\"\]" .github/workflows/eas-build.yml
grep -q "Invalid strict_lockfile override" .github/workflows/eas-build.yml
grep -q "Strict lockfile policy:" .github/workflows/eas-build.yml

grep -q "strict_lockfile:" .github/workflows/k1w1-triggered-build.yml
grep -q "autofix:" .github/workflows/k1w1-triggered-build.yml
grep -q "inputs.strict_lockfile" .github/workflows/k1w1-triggered-build.yml
grep -q "inputs.autofix" .github/workflows/k1w1-triggered-build.yml

grep -q "strict_lockfile" lib/diagnostics/workflowTemplates.ts

echo "EAS manual trigger controls invariants passed."
