#!/usr/bin/env bash
set -euo pipefail

echo "== PR-8 Stage 6: Context import drift audit (blocking) =="
echo "Repo: $(pwd)"
echo

read -r -d '' PATTERN <<'PAT'
import\s+type\s+\{[^}]*\b(BuildStatusDetails|BuildStatus|BuildHistoryEntry)\b[^}]*\}\s+from\s+["'][^"']*contexts/types["']
PAT

set +e
matches=$(rg -n --hidden --glob '!.git' --glob '!node_modules' --glob '*.ts' --glob '*.tsx' \
  "$PATTERN" . 2>&1)
rc=$?
set -e

# rg exit codes: 0=matches, 1=no matches, 2=error (regex parse etc.)
if [[ $rc -eq 1 ]]; then
  echo "✅ No remaining Build* type imports from contexts/types found."
  exit 0
fi

if [[ $rc -eq 2 ]]; then
  echo "❌ rg failed (pattern error). Fix the audit script."
  echo
  echo "$matches"
  exit 2
fi

echo "❌ Found forbidden imports of Build* types from contexts/types:"
echo
echo "$matches"
echo
echo "Fix: import these types from shared/types/build instead."
exit 1
