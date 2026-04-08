#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

FILE="supabase/functions/k1w1-handler/helpers.ts"
TYPES_FILE="supabase/functions/k1w1-handler/helpers/types.ts"
PROVIDERS_FILE="supabase/functions/k1w1-handler/helpers/providers.ts"
INDEX="supabase/functions/k1w1-handler/index.ts"

[ -f "$FILE" ] || fail "Missing $FILE"
[ -f "$TYPES_FILE" ] || fail "Missing $TYPES_FILE"
[ -f "$PROVIDERS_FILE" ] || fail "Missing $PROVIDERS_FILE"
[ -f "$INDEX" ] || fail "Missing $INDEX"

grep -q 'export const DEFAULT_MODELS = SHARED_PROVIDER_DEFAULTS;' "$TYPES_FILE" || fail "Missing DEFAULT_MODELS export"
grep -q 'const qualityConfig = DEFAULT_MODELS.openai;' "$PROVIDERS_FILE" || fail "Missing openai defaults usage"
grep -q 'const qualityConfig = DEFAULT_MODELS.anthropic;' "$PROVIDERS_FILE" || fail "Missing anthropic defaults usage"
grep -q 'const qualityConfig = DEFAULT_MODELS.huggingface;' "$PROVIDERS_FILE" || fail "Missing huggingface defaults usage"

grep -q 'export async function callOpenAI(' "$PROVIDERS_FILE" || fail "Missing callOpenAI"
grep -q 'export async function callAnthropic(' "$PROVIDERS_FILE" || fail "Missing callAnthropic"
grep -q 'export async function callHuggingFace(' "$PROVIDERS_FILE" || fail "Missing callHuggingFace"

grep -q 'getRuntimeEnv("OPENAI_API_KEY")' "$PROVIDERS_FILE" || fail "Missing OPENAI_API_KEY runtime env usage"
grep -q 'getRuntimeEnv("ANTHROPIC_API_KEY")' "$PROVIDERS_FILE" || fail "Missing ANTHROPIC_API_KEY runtime env usage"
grep -q 'getRuntimeEnv("HUGGINGFACE_API_KEY")' "$PROVIDERS_FILE" || fail "Missing HUGGINGFACE_API_KEY runtime env usage"

! grep -q 'Deno.env.get("OPENAI_API_KEY")' "$PROVIDERS_FILE" || fail "Forbidden OPENAI_API_KEY Deno.env usage/comment"
! grep -q 'Deno.env.get("ANTHROPIC_API_KEY")' "$PROVIDERS_FILE" || fail "Forbidden ANTHROPIC_API_KEY Deno.env usage/comment"
! grep -q 'Deno.env.get("HUGGINGFACE_API_KEY")' "$PROVIDERS_FILE" || fail "Forbidden HUGGINGFACE_API_KEY Deno.env usage/comment"

grep -q 'providerLower === "openai"' "$INDEX" || fail "Missing openai routing"
grep -q 'providerLower === "anthropic"' "$INDEX" || fail "Missing anthropic routing"
grep -q 'providerLower === "huggingface"' "$INDEX" || fail "Missing huggingface routing"

echo "k1w1-handler provider check passed."
