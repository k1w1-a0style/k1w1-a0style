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
grep -Fq 'Validate / sanitize dispatch inputs' "$FILE" || fail "Missing central dispatch input sanitizer step"
grep -Fq 'id: sanitize_inputs' "$FILE" || fail "Missing sanitizer step id"
grep -Fq 'git check-ref-format --branch "$REF_INPUT"' "$FILE" || fail "Missing git-compatible ref validation"
grep -Fq 'if [ -n "$FUNCTION_NAME_INPUT" ] && ! [[ "$FUNCTION_NAME_INPUT" =~ ^[A-Za-z0-9_][A-Za-z0-9_-]*$ ]]; then' "$FILE" || fail "Missing hardened function_name validation"
grep -Fq 'if [ "$FUNCTION_NAME" = "_shared" ]; then' "$FILE" || fail "Missing reserved _shared guard"
grep -Fq 'supabase functions deploy "$FUNCTION_NAME"' "$FILE" || fail "Missing single-function deploy path"
grep -Fq 'auto|true|false' "$FILE" || fail "Missing apply_migrations validation choices"
grep -Fq 'git diff --quiet HEAD^ HEAD -- supabase/migrations' "$FILE" || fail "Missing migration auto-detect policy"
grep -Fq '} >> "$GITHUB_OUTPUT"' "$FILE" || fail "Missing grouped GITHUB_OUTPUT append pattern"
grep -Fq '} >> "$GITHUB_ENV"' "$FILE" || fail "Missing grouped GITHUB_ENV append pattern"
grep -Fq 'printf '\''DEPLOY_ALL_SAFE=%s\n'\'' "$DEPLOY_ALL_INPUT"' "$FILE" || fail "Missing safe GITHUB_ENV export via printf"
if grep -Fq 'github.event.inputs.' "$FILE"; then
  fail "Raw github.event.inputs usage must not appear in deploy workflow"
fi

echo "Supabase deploy workflow invariants OK"
