#!/usr/bin/env bash
set -euo pipefail

echo "== PR-8 Stage 5: Context import drift audit (informational) =="
echo "Repo: $(pwd)"
echo

# Informational only (exit 0). Goal: stop importing domain build types from contexts/types.
# Prefer shared/types/build for:
#   - BuildStatus
#   - BuildStatusDetails
#   - BuildHistoryEntry

TYPE_PATTERN='(BuildStatusDetails|BuildStatus|BuildHistoryEntry)'

# Find TS/TSX files that both mention the type names and import from contexts/types.
matches=$(
  rg -n --hidden --glob '!.git' --glob '!node_modules' --glob '*.ts' --glob '*.tsx' \
    "$TYPE_PATTERN" . \
    | rg -n 'from\s+["'\''](\.\.\/)*contexts\/types["'\'']' \
    || true
)

if [[ -z "${matches}" ]]; then
  echo "✅ No remaining Build* imports from contexts/types found."
  echo "   (Good. Prefer shared/types/build directly for domain build types.)"
  exit 0
fi

echo "⚠️  Found remaining imports of Build* types from contexts/types:"
echo
echo "${matches}"
echo
echo "Suggested fix (example):"
echo "  - Replace: import type { BuildStatusDetails } from \"../contexts/types\""
echo "  - With:    import type { BuildStatusDetails } from \"../shared/types/build\""
echo
echo "Note: This audit is informational and does not fail."
exit 0
