#!/usr/bin/env bash
set -euo pipefail

echo "== PR-8 Stage 6: Context import drift audit (blocking) =="
echo "Repo: $(pwd)"
echo

# Block drift: domain build types must NOT be imported from contexts/types.
# Prefer shared/types/build directly.

PATTERN=$'import\\s+type\\s+\\{[^}]*\\b(BuildStatusDetails|BuildStatus|BuildHistoryEntry)\\b[^}]*\\}\\s+from\\s+["\\\'](\\.\\./)*contexts/types["\\\']'

matches=$(
  rg -n --hidden --glob '!.git' --glob '!node_modules' --glob '*.ts' --glob '*.tsx'     "$PATTERN" .     || true
)

if [[ -z "${matches}" ]]; then
  echo "✅ No remaining Build* type imports from contexts/types found."
  exit 0
fi

echo "❌ Found forbidden imports of Build* types from contexts/types:"
echo
echo "${matches}"
echo
echo "Fix: import these types from shared/types/build instead."
exit 1
