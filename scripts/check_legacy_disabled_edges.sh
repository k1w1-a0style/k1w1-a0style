#!/usr/bin/env bash
set -euo pipefail

CONFIG="supabase/config.toml"

require_fixed() {
  local file="$1"
  local needle="$2"
  if ! grep -Fq "$needle" "$file"; then
    echo "[FAIL] Missing in $file: $needle" >&2
    exit 1
  fi
}

legacy=(
  "trigger-lint"
  "check-lint"
  "trigger-native-sync"
  "check-native-sync"
  "native-sync-report"
  "native-sync-report-ingest"
)

for fn in "${legacy[@]}"; do
  require_fixed "$CONFIG" "[functions.${fn}]"
  python3 - "$CONFIG" "$fn" <<'PY'
from pathlib import Path
import sys
cfg = Path(sys.argv[1]).read_text().splitlines()
name = sys.argv[2]
section = f"[functions.{name}]"
for i, line in enumerate(cfg):
    if line.strip() == section:
        window = cfg[i+1:i+6]
        if any(l.strip() == 'enabled = false' for l in window):
            raise SystemExit(0)
        raise SystemExit(1)
raise SystemExit(1)
PY
  require_fixed "supabase/functions/${fn}/index.ts" 'disabled: true'
  require_fixed "supabase/functions/${fn}/index.ts" 'status: 410'
done

echo "legacy disabled edge checks passed."
