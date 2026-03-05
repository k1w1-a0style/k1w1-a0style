#!/usr/bin/env bash
set -euo pipefail

FILE="${1:-.env.ci-lite.local}"
if [[ ! -f "$FILE" ]]; then
  echo "Missing $FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$FILE"
set +a

: "${SUPABASE_URL:?SUPABASE_URL missing}"
: "${ADMIN_KEY:?ADMIN_KEY missing (should equal SIGNING_ADMIN_KEY)}"

echo "Loaded env from $FILE"
echo "SUPABASE_URL=$SUPABASE_URL"
echo "ADMIN_KEY=[SET]"
