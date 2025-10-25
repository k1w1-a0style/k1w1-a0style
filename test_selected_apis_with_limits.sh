#!/usr/bin/env bash
# test_selected_apis_with_limits.sh
# Testet: Google Gemini (mehrere Endpoints), Anthropic, OpenAI, Groq
# Gibt aus: HTTP-Status, gekürzten Body, alle Response-Header (siehe auf Rate-Limit-Header)
# Achtung: Keys sind hardcoded wie gewünscht. Entferne/ersetze sie nach Bedarf.

set -Eeuo pipefail
GREEN="\e[1;32m"; RED="\e[1;31m"; YELLOW="\e[1;33m"; BLUE="\e[1;34m"; NC="\e[0m"

info(){ printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
ok(){ printf "${GREEN}[GREEN]${NC} %s\n" "$1"; }
bad(){ printf "${RED}[RED]${NC} %s\n" "$1"; }
warn(){ printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }

# -----------------------
# KEYS (vom Nutzer angegeben)
# -----------------------
GEMINI_KEY="AIzaSyCIKitND5wjIVN9TK1P0JIpC5OMwBnjUF8"
ANTHROPIC_KEY="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"
OPENAI_KEY="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"
GROQ_KEY="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"

mask(){ printf "%s" "$1" | sed -E 's/(.{4}).*(.{4})/\1...\2/'; }

TMPDIR="/tmp/api_check_$$"
mkdir -p "$TMPDIR"
cleanup(){ rm -rf "$TMPDIR"; }
trap cleanup EXIT

# helper: perform request, save headers+body, return code
# args: method url header1 header2 ...
do_req_capture(){
  local method="$1"; shift
  local url="$1"; shift
  local out_hdr="$TMPDIR/headers.tmp"
  local out_body="$TMPDIR/body.tmp"
  rm -f "$out_hdr" "$out_body"
  local curl_args=( -sS -D "$out_hdr" -o "$out_body" -w "%{http_code}" -X "$method" "$url" )
  for h in "$@"; do curl_args+=( -H "$h" ); done
  # timeout 15s
  http_code=$(timeout 15s curl "${curl_args[@]}" 2>/dev/null || echo "000")
  printf "%s|%s|%s" "$http_code" "$out_hdr" "$out_body"
}

# helper: print header subset that looks like rate-limit info
print_rate_headers(){
  local hdrfile="$1"
  echo "---- Rate/Quota related headers (if present) ----"
  grep -iE 'rate|quota|x-ratelimit|x-goog|x-request' "$hdrfile" 2>/dev/null || echo "(none found)"
  echo "---- All headers (first 50 lines) ----"
  head -n 50 "$hdrfile" 2>/dev/null || true
  echo
}

# helper: print short body (first 200 lines) and extract model ids (if JSON and jq present)
print_body_and_models(){
  local bodyfile="$1"
  echo "---- Body (first 200 lines) ----"
  head -n 200 "$bodyfile" || true
  echo
  if command -v jq >/dev/null 2>&1; then
    echo "---- Parsed model ids / names (jq heuristics) ----"
    jq -r 'if .data then (.data[]?.id // .data[]?.modelId // .data[]?.name) elif type=="array" then (.[]? | .id // .modelId // .name) else (.modelId // .id // .name // .model) end' "$bodyfile" 2>/dev/null | sed -n '1,200p' || true
    echo
  fi
}

echo
info "== Starte API-Checks mit Limit/Quota-Header-Prüfung =="

################
# 1) GEMINI (robust: mehrere endpoints tried)
################
info "== GEMINI (Google Generative Language) =="

# endpoints to try (order: v1, v1beta, v1beta2, public list)
GEMINI_ENDPOINTS=(
  "https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_KEY}"
  "https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}"
  "https://generativelanguage.googleapis.com/v1beta2/models?key=${GEMINI_KEY}"
  "https://ai.google.dev/api/models"  # public listing page (may be HTML/JSON)
)

gemini_success=0
for ep in "${GEMINI_ENDPOINTS[@]}"; do
  info "Testing Gemini endpoint: $ep"
  read code hdr body <<< "$(do_req_capture GET "$ep")"
  echo "[HTTP $code]"
  print_rate_headers "$hdr"
  print_body_and_models "$body"
  if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    ok "Gemini endpoint OK (HTTP $code) -> treated as GREEN"
    gemini_success=1
    break
  else
    warn "Gemini endpoint returned HTTP $code"
  fi
done

if [[ $gemini_success -eq 0 ]]; then bad "All Gemini endpoints failed (see outputs)"; fi
echo "Gemini key (masked): $(mask "$GEMINI_KEY")"
echo

################
# 2) ANTHROPIC
################
info "== ANTHROPIC =="
ANTH_URL="https://api.anthropic.com/v1/models"
read code hdr body <<< "$(do_req_capture GET "$ANTH_URL" "x-api-key: ${ANTHROPIC_KEY}" "anthropic-version: 2023-06-01")"
echo "[HTTP $code]"
print_rate_headers "$hdr"
print_body_and_models "$body"
if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then ok "Anthropic reachable (GREEN)"; else bad "Anthropic NOT reachable (RED)"; fi
echo "Anthropic key (masked): $(mask "$ANTHROPIC_KEY")"
echo

################
# 3) OPENAI
################
info "== OPENAI =="
OPENAI_URL="https://api.openai.com/v1/models"
read code hdr body <<< "$(do_req_capture GET "$OPENAI_URL" "Authorization: Bearer ${OPENAI_KEY}" "Content-Type: application/json")"
echo "[HTTP $code]"
print_rate_headers "$hdr"
print_body_and_models "$body"
if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then ok "OpenAI reachable (GREEN)"; else bad "OpenAI NOT reachable (RED)"; fi
echo "OpenAI key (masked): $(mask "$OPENAI_KEY")"
echo

################
# 4) GROQ
################
info "== GROQ =="
GROQ_URL="https://api.groq.com/openai/v1/models"
read code hdr body <<< "$(do_req_capture GET "$GROQ_URL" "Authorization: Bearer ${GROQ_KEY}" "Content-Type: application/json")"
echo "[HTTP $code]"
print_rate_headers "$hdr"
print_body_and_models "$body"
if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then ok "Groq reachable (GREEN)"; else bad "Groq NOT reachable (RED)"; fi
echo "Groq key (masked): $(mask "$GROQ_KEY")"
echo

################
# Summary file (optional)
################
SUMMARY="$TMPDIR/summary.json"
printf '{ "checked_at":"%s", "keys": { "gemini":"%s", "anthropic":"%s", "openai":"%s", "groq":"%s" } }\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$(mask "$GEMINI_KEY")" "$(mask "$ANTHROPIC_KEY")" "$(mask "$OPENAI_KEY")" "$(mask "$GROQ_KEY")" > "$SUMMARY"
info "Ergebnis-Zusammenfassung gespeichert: $SUMMARY"
info "Wenn du JSON-Ausgabe ausführlicher willst, installiere 'jq' (sudo apt update && sudo apt install -y jq)"

info "Fertig."
