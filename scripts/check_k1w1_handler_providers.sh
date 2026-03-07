#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

FILE="supabase/functions/k1w1-handler/helpers.ts"
INDEX="supabase/functions/k1w1-handler/index.ts"

[ -f "$FILE" ] || fail "Missing $FILE"
[ -f "$INDEX" ] || fail "Missing $INDEX"

grep -q 'openai:' "$FILE" || fail "Missing openai defaults"
grep -q 'anthropic:' "$FILE" || fail "Missing anthropic defaults"
grep -q 'huggingface:' "$FILE" || fail "Missing huggingface defaults"

grep -q 'export async function callOpenAI(' "$FILE" || fail "Missing callOpenAI"
grep -q 'export async function callAnthropic(' "$FILE" || fail "Missing callAnthropic"
grep -q 'export async function callHuggingFace(' "$FILE" || fail "Missing callHuggingFace"

grep -q 'Deno.env.get("OPENAI_API_KEY")' "$FILE" || fail "Missing OPENAI_API_KEY usage"
grep -q 'Deno.env.get("ANTHROPIC_API_KEY")' "$FILE" || fail "Missing ANTHROPIC_API_KEY usage"
grep -q 'Deno.env.get("HUGGINGFACE_API_KEY")' "$FILE" || fail "Missing HUGGINGFACE_API_KEY usage"

grep -q 'providerLower === "openai"' "$INDEX" || fail "Missing openai routing"
grep -q 'providerLower === "anthropic"' "$INDEX" || fail "Missing anthropic routing"
grep -q 'providerLower === "huggingface"' "$INDEX" || fail "Missing huggingface routing"

echo "k1w1-handler provider check passed."
