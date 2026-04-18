#!/usr/bin/env bash
set -euo pipefail

CONFIG="supabase/config.toml"

if [ ! -f "$CONFIG" ]; then
  echo "[FAIL] Missing config file: $CONFIG" >&2
  exit 1
fi

if ! head -c 1 "$CONFIG" >/dev/null 2>&1; then
  echo "[FAIL] Config file is not readable: $CONFIG" >&2
  exit 1
fi

legacy=(
  "trigger-lint"
  "check-lint"
  "trigger-native-sync"
  "check-native-sync"
  "native-sync-report"
  "native-sync-report-ingest"
  "create_codesandbox"
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
