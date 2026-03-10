#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

FILE=".github/workflows/deploy-supabase-functions.yml"
[ -f "$FILE" ] || fail "Missing workflow: $FILE"

grep -Fq 'name: Deploy Supabase (Edge Functions)' "$FILE" || fail "Unexpected workflow name"
grep -Fq 'workflow_dispatch:' "$FILE" || fail "Missing workflow_dispatch trigger"
if grep -Eq '^\s+push:' "$FILE"; then
  fail "Workflow must not auto-deploy on push"
fi
grep -Fq 'apply_migrations:' "$FILE" || fail "Missing workflow_dispatch input: apply_migrations"
grep -Fq 'required: true' "$FILE" || fail "Missing required ref input"
grep -Fq 'supabase db push' "$FILE" || fail "Missing supabase db push step"
grep -Fq 'if ! [[ "$FUNCTION_NAME" =~ ^[A-Za-z0-9_-]+$ ]]; then' "$FILE" || fail "Missing function name validation"
grep -Fq 'if [ "$FUNCTION_NAME" = "_shared" ]; then' "$FILE" || fail "Missing reserved _shared guard"
grep -Fq 'supabase functions deploy "$FUNCTION_NAME"' "$FILE" || fail "Missing single-function deploy path"
grep -Fq 'auto|true|false' "$FILE" || fail "Missing apply_migrations validation choices"
grep -Fq 'git diff --quiet HEAD^ HEAD -- supabase/migrations' "$FILE" || fail "Missing migration auto-detect policy"

echo "Supabase deploy workflow invariants OK"
