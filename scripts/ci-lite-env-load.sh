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

WORKFLOW_ADMIN="${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-${ADMIN_KEY:-${K1W1_EDGE_ADMIN_KEY:-}}}"
: "${WORKFLOW_ADMIN:?Missing workflow admin key (set K1W1_EDGE_WORKFLOW_ADMIN_KEY or legacy ADMIN_KEY/K1W1_EDGE_ADMIN_KEY)}"

echo "Loaded env from $FILE"
echo "SUPABASE_URL=$SUPABASE_URL"
echo "K1W1_EDGE_WORKFLOW_ADMIN_KEY=[SET]"
