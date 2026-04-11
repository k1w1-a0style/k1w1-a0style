#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
#   export SUPABASE_ANON_KEY="eyJ..."   # optional, aber empfohlen
#   export EDGE_BASE_URL="https://xfgnzpcljsuqqdjlxgul.supabase.co/functions/v1"  # optional override
#   bash scripts/edge-fn-smoke-test.sh

BASE_URL="${EDGE_BASE_URL:-https://xfgnzpcljsuqqdjlxgul.supabase.co/functions/v1}"
SRK="${SUPABASE_SERVICE_ROLE_KEY:-}"
ANON="${SUPABASE_ANON_KEY:-}"

PASS=0
FAIL=0
WARN=0

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[0;33m'
reset='\033[0m'

ok()   { echo -e "  ${green}✅ PASS${reset} $*"; PASS=$((PASS+1)); }
fail() { echo -e "  ${red}❌ FAIL${reset} $*"; FAIL=$((FAIL+1)); }
warn() { echo -e "  ${yellow}⚠️  WARN${reset} $*"; WARN=$((WARN+1)); }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Fehlt: $1"
    exit 1
  }
}

need_cmd curl
need_cmd mktemp
need_cmd head
need_cmd tr

if [ -z "$SRK" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY fehlt."
  echo 'Beispiel: export SUPABASE_SERVICE_ROLE_KEY="eyJ..."'
  exit 1
fi

TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

call() {
  local fn="$1"
  local method="${2:-POST}"
  local auth="${3:-}"
  local body="${4:-}"

  local curl_args=(
    -sS
    -o "$TMP_BODY"
    -w "%{http_code}"
    -X "$method"
    "$BASE_URL/$fn"
    --max-time 20
  )

  if [ "$method" != "GET" ] && [ "$method" != "HEAD" ]; then
    curl_args+=(-H "Content-Type: application/json")
    if [ -n "$body" ]; then
      curl_args+=(-d "$body")
    else
      curl_args+=(-d "{}")
    fi
  fi

  if [ -n "$auth" ]; then
    curl_args+=(-H "Authorization: Bearer $auth")
  fi

  local status
  status="$(curl "${curl_args[@]}" 2>/dev/null || echo "000")"
  local body_out
  body_out="$(head -c 240 "$TMP_BODY" 2>/dev/null | tr '\n' ' ' || true)"
  echo "${status}|||${body_out}"
}

status_of() { echo "$1" | cut -d'|' -f1; }
body_of()   { echo "$1" | sed 's/^[0-9]*|||//'; }

expect_status() {
  local got="$1"
  local expected="$2"
  [ "$got" = "$expected" ]
}

expect_one_of() {
  local got="$1"
  shift
  local candidate
  for candidate in "$@"; do
    [ "$got" = "$candidate" ] && return 0
  done
  return 1
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Edge Function Smoke Test"
echo " BASE_URL=$BASE_URL"
echo " Zeit: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo "BLOCK A — verify_jwt=true: ohne Token → 401"
echo "──────────────────────────────────────────────────────"
for FN in \
  k1w1-handler \
  trigger-eas-build \
  check-eas-build \
  github-workflow-dispatch \
  github-workflow-logs \
  github-workflow-runs \
  save_preview \
  android-keystore-generate \
  android-keystore-status \
  android-keystore-export \
  github-run-artifact-json
do
  R="$(call "$FN" POST "" '{}')"
  S="$(status_of "$R")"
  B="$(body_of "$R")"
  if expect_status "$S" "401"; then
    ok "$FN → 401"
  else
    fail "$FN → $S (erwartet 401) | $B"
  fi
done

echo
echo "BLOCK B — anon key → 401/403 bei sensitiven Funktionen"
echo "──────────────────────────────────────────────────────"
if [ -z "$ANON" ]; then
  warn "SUPABASE_ANON_KEY nicht gesetzt — Block B übersprungen"
else
  for FN in \
    k1w1-handler \
    trigger-eas-build \
    check-eas-build \
    github-workflow-dispatch \
    github-workflow-logs \
    github-workflow-runs \
    android-keystore-generate \
    android-keystore-status \
    android-keystore-export \
    github-run-artifact-json
  do
    R="$(call "$FN" POST "$ANON" '{}')"
    S="$(status_of "$R")"
    B="$(body_of "$R")"
    if expect_one_of "$S" "401" "403"; then
      ok "$FN → $S (anon abgewiesen)"
    else
      fail "$FN → $S (erwartet 401/403) | $B"
    fi
  done
fi

echo
echo "BLOCK C — service_role darf nicht an Auth scheitern"
echo "──────────────────────────────────────────────────────"
for FN in \
  k1w1-handler \
  trigger-eas-build \
  check-eas-build \
  github-workflow-dispatch \
  github-workflow-logs \
  github-workflow-runs \
  save_preview \
  android-keystore-generate \
  android-keystore-status \
  android-keystore-export \
  github-run-artifact-json
do
  R="$(call "$FN" POST "$SRK" '{}')"
  S="$(status_of "$R")"
  B="$(body_of "$R")"
  if expect_one_of "$S" "401" "403" "000"; then
    fail "$FN → $S (service_role darf hier nicht an Auth/Netz scheitern) | $B"
  else
    ok "$FN → $S"
  fi
done

echo
echo "BLOCK D — Method Guards"
echo "──────────────────────────────────────────────────────"

R="$(call "k1w1-handler" GET "$SRK" "")"
S="$(status_of "$R")"
B="$(body_of "$R")"
if expect_status "$S" "405"; then
  ok "k1w1-handler GET → 405"
else
  fail "k1w1-handler GET → $S (erwartet 405) | $B"
fi

R="$(call "save_preview" GET "$SRK" "")"
S="$(status_of "$R")"
B="$(body_of "$R")"
if expect_one_of "$S" "405" "400"; then
  ok "save_preview GET → $S"
else
  fail "save_preview GET → $S (erwartet 405/400) | $B"
fi

R="$(call "preview_page" POST "" '{}')"
S="$(status_of "$R")"
B="$(body_of "$R")"
if expect_one_of "$S" "405" "400"; then
  ok "preview_page POST → $S"
else
  fail "preview_page POST → $S (erwartet 405/400) | $B"
fi

echo
echo "BLOCK E — preview_page GET ohne Auth erreichbar, aber nicht 401/403"
echo "──────────────────────────────────────────────────────"
R="$(call "preview_page" GET "" "")"
S="$(status_of "$R")"
B="$(body_of "$R")"
if expect_one_of "$S" "200" "400" "404" "429"; then
  ok "preview_page GET → $S"
else
  fail "preview_page GET → $S (unerwartet) | $B"
fi

echo
echo "BLOCK F — Legacy Stubs"
echo "──────────────────────────────────────────────────────"
for FN in create_codesandbox test; do
  R="$(call "$FN" POST "$SRK" '{}')"
  S="$(status_of "$R")"
  B="$(body_of "$R")"
  if expect_status "$S" "410"; then
    ok "$FN → 410 Gone"
  else
    warn "$FN → $S (erwartet 410, bitte prüfen) | $B"
  fi
done

echo
echo "BLOCK G — einfacher Rate-Limit-Shape-Check für preview_page"
echo "──────────────────────────────────────────────────────"
for i in 1 2 3; do
  R="$(call "preview_page" GET "" "")"
  S="$(status_of "$R")"
  echo "  preview_page Request $i → HTTP $S"
done

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ERGEBNIS: ${PASS} PASS | ${FAIL} FAIL | ${WARN} WARN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
