#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

FILE=".github/workflows/deploy-supabase-functions.yml"
[ -f "$FILE" ] || fail "Missing workflow: $FILE"

grep -Fq 'name: Deploy Supabase (Edge Functions)' "$FILE" || fail "Unexpected workflow name"
grep -Fq 'function_name:' "$FILE" || fail "Missing workflow_dispatch input: function_name"
grep -Fq 'npm i -g supabase@2.72.7' "$FILE" || fail "Supabase CLI is no longer pinned"
grep -Fq 'supabase login --token' "$FILE" || fail "Missing supabase login step"
grep -Fq 'supabase link --project-ref' "$FILE" || fail "Missing supabase link step"
grep -Fq '[ "$name" != "_shared" ]' "$FILE" || fail "Missing _shared deploy guard"
grep -Fq "FUNCTION_NAME_INPUT: \${{ github.event.inputs.function_name || '' }}" "$FILE" || fail "Missing FUNCTION_NAME_INPUT wiring"
grep -Fq 'if [ "$FUNCTION_NAME" = "_shared" ]; then' "$FILE" || fail "Missing reserved _shared guard"
grep -Fq 'if [ ! -d "functions/$FUNCTION_NAME" ]; then' "$FILE" || fail "Missing function directory existence guard"
grep -Fq 'supabase functions deploy "$FUNCTION_NAME"' "$FILE" || fail "Missing single-function deploy path"

echo "Supabase deploy workflow invariants passed."
