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

WORKFLOW_ADMIN="${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-}"
: "${WORKFLOW_ADMIN:?Missing required K1W1_EDGE_WORKFLOW_ADMIN_KEY (workflow/build/artifact scripts do not accept ADMIN_KEY or K1W1_EDGE_ADMIN_KEY fallback).}"

WORKFLOW_JWT="${K1W1_EDGE_WORKFLOW_JWT:-}"
: "${WORKFLOW_JWT:?Missing required K1W1_EDGE_WORKFLOW_JWT (workflow/build/artifact scripts require Authorization: Bearer <jwt> for verify_jwt=true routes).}"

echo "Loaded env from $FILE"
echo "SUPABASE_URL=$SUPABASE_URL"
echo "K1W1_EDGE_WORKFLOW_ADMIN_KEY=[SET]"
echo "K1W1_EDGE_WORKFLOW_JWT=[SET]"
