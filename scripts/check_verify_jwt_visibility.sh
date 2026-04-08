#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CFG="supabase/config.toml"
DOC="docs/EDGE_FUNCTIONS_STATUS.md"

require_verify() {
  local fn="$1"
  local expected="$2"
  awk -v fn="$fn" -v expected="$expected" '
    $0 ~ "^\\[functions\\." fn "\\]" { in_block=1; next }
    /^\[functions\./ { in_block=0 }
    in_block && $0 ~ /^verify_jwt\s*=\s*(true|false)/ {
      gsub(/ /, "", $0)
      split($0,a,"=")
      found=a[2]
      if (found == expected) ok=1
      else bad=1
    }
    END {
      if (!ok || bad) exit 1
    }
  ' "$CFG" || {
    echo "[FAIL] verify_jwt mismatch for functions.${fn} (expected ${expected})" >&2
    exit 1
  }
}

require_verify "save_preview" "true"
require_verify "k1w1-handler" "true"
require_verify "preview_page" "false"
require_verify "trigger-eas-build" "true"
require_verify "check-eas-build" "true"

grep -Fq 'save_preview` nutzt jetzt **verifiziertes Supabase-Login-JWT**' "$DOC" || {
  echo "[FAIL] missing save_preview verify_jwt visibility note in $DOC" >&2
  exit 1
}

grep -Fq 'k1w1-handler` | KI-Provider-Proxy' "$DOC" || {
  echo "[FAIL] missing k1w1-handler visibility line in $DOC" >&2
  exit 1
}

echo "verify_jwt visibility check passed."
