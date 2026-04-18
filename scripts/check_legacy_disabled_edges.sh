#!/usr/bin/env bash
set -euo pipefail

CONFIG="supabase/config.toml"

legacy=(
  "trigger-lint"
  "check-lint"
  "trigger-native-sync"
  "check-native-sync"
  "native-sync-report"
  "native-sync-report-ingest"
)

for fn in "${legacy[@]}"; do
  if grep -Fq "[functions.${fn}]" "$CONFIG"; then
    echo "[FAIL] Legacy function still configured in $CONFIG: $fn" >&2
    exit 1
  fi

  if [ -d "supabase/functions/${fn}" ]; then
    echo "[FAIL] Legacy function directory still present: supabase/functions/${fn}" >&2
    exit 1
  fi
done

echo "legacy disabled edge checks passed."
