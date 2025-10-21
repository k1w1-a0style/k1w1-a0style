#!/usr/bin/env bash
# test_selected_apis.sh
# Testet exklusiv: Google Gemini (Generative Language), Anthropic, OpenAI, Groq
# Ausgabe: GRÜN (reachable 2xx) oder ROT (nicht erreichbar) + verfügbare Modell-IDs (sofern API liefert)

set -Eeuo pipefail
GREEN="\e[1;32m"
RED="\e[1;31m"
YELLOW="\e[1;33m"
NC="\e[0m"

info(){ printf "${GREEN}[INFO]${NC} %s\n" "$1"; }
ok(){ printf "${GREEN}[GREEN]${NC} %s\n" "$1"; }
bad(){ printf "${RED}[RED]${NC} %s\n" "$1"; }
warn(){ printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }

# -----------------------
# KEYS (wie vom Nutzer angegeben)
# -----------------------
# Achtung: diese Keys sind im Script hardcoded — geh damit vorsichtig um.
GEMINI_KEY="AIzaSyCIKitND5wjIVN9TK1P0JIpC5OMwBnjUF8"
ANTHROPIC_KEY="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"
OPENAI_KEY="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"
GROQ_KEY="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"

# Maskiert Key (zeigt nur Anfang/Ende)
mask(){ echo "$1" | sed -E 's/(.{4}).*(.{4})/\1...\2/'; }

# temp files
TMP="/tmp/api_test_resp_$$"
rm -f "${TMP}"*

# helper: do curl and return http code and file path
do_req(){
  local method="$1"; local url="$2"; shift 2
  local headers=("$@")
  rm -f "${TMP}.resp"
  local curl_args=("-sS" "-o" "${TMP}.resp" "-w" "%{http_code}" "-X" "$method" "$url")
  for h in "${headers[@]}"; do
    curl_args+=( -H "$h" )
  done
  http_code=$(curl "${curl_args[@]}" 2>/dev/null || echo "000")
  printf "%s %s" "$http_code" "${TMP}.resp"
}

# pretty print JSON if jq available, else raw head
print_models(){
  local file="$1"
  if command -v jq >/dev/null 2>&1; then
    # try several common JSON structures
    jq -r 'if .data then .data[]? | (.id // .modelId // .name) elif type=="array" then .[]? | (.id // .modelId // .name) else .id // .modelId // .name end' "$file" 2>/dev/null | sed -n '1,200p' || head -n 40 "$file"
  else
    head -n 40 "$file"
  fi
}

echo
info "Starte API-Checks (nur: Gemini, Anthropic, OpenAI, Groq)."

# -----------------------
# 1) Google Gemini (Generative Language API)
# Endpoint: GET https://generativelanguage.googleapis.com/v1/models?key=API_KEY
# -----------------------
echo
info "GEMINI (Google Generative Language) — Test"
GEMINI_URL="https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_KEY}"
read code file <<< $(do_req GET "$GEMINI_URL")
if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
  ok "Gemini reachable (HTTP $code)."
  echo "Model-Liste (gekürzt):"
  print_models "$file"
else
  bad "Gemini NOT reachable (HTTP $code)."
  [ -s "$file" ] && head -n 30 "$file"
fi
echo "Key (masked): $(mask "$GEMINI_KEY")"
echo

# -----------------------
# 2) Anthropic
# Endpoint: GET https://api.anthropic.com/v1/models
# Header: x-api-key: KEY ; anthropic-version header optional but recommended
# -----------------------
echo
info "ANTHROPIC — Test"
ANTHROPIC_URL="https://api.anthropic.com/v1/models"
read code file <<< $(do_req GET "$ANTHROPIC_URL" "x-api-key: ${ANTHROPIC_KEY}" "anthropic-version: 2023-06-01")
if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
  ok "Anthropic reachable (HTTP $code)."
  echo "Model-Liste (gekürzt):"
  print_models "$file"
else
  bad "Anthropic NOT reachable (HTTP $code)."
  [ -s "$file" ] && head -n 30 "$file"
fi
echo "Key (masked): $(mask "$ANTHROPIC_KEY")"
echo

# -----------------------
# 3) OpenAI
# Endpoint: GET https://api.openai.com/v1/models
# Header: Authorization: Bearer KEY
# -----------------------
echo
info "OPENAI — Test"
OPENAI_URL="https://api.openai.com/v1/models"
read code file <<< $(do_req GET "$OPENAI_URL" "Authorization: Bearer ${OPENAI_KEY}" "Content-Type: application/json")
if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
  ok "OpenAI reachable (HTTP $code)."
  echo "Model-Liste (gekürzt):"
  print_models "$file"
else
  bad "OpenAI NOT reachable (HTTP $code)."
  [ -s "$file" ] && head -n 30 "$file"
fi
echo "Key (masked): $(mask "$OPENAI_KEY")"
echo

# -----------------------
# 4) Groq
# Endpoint (OpenAI compatible): GET https://api.groq.com/openai/v1/models
# Header: Authorization: Bearer KEY
# -----------------------
echo
info "GROQ — Test"
GROQ_URL="https://api.groq.com/openai/v1/models"
read code file <<< $(do_req GET "$GROQ_URL" "Authorization: Bearer ${GROQ_KEY}" "Content-Type: application/json")
if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
  ok "Groq reachable (HTTP $code)."
  echo "Model-Liste (gekürzt):"
  print_models "$file"
else
  bad "Groq NOT reachable (HTTP $code)."
  [ -s "$file" ] && head -n 30 "$file"
fi
echo "Key (masked): $(mask "$GROQ_KEY")"
echo

# -----------------------
# Summary
# -----------------------
echo
printf "%s\n" "===== Zusammenfassung ====="
printf "Gemini key: %s\n" "$(mask "$GEMINI_KEY")"
printf "Anthropic key: %s\n" "$(mask "$ANTHROPIC_KEY")"
printf "OpenAI key: %s\n" "$(mask "$OPENAI_KEY")"
printf "Groq key: %s\n" "$(mask "$GROQ_KEY")"
echo
warn "Wenn du schön geparste JSON-Ausgabe willst, installiere 'jq' (sudo apt update && sudo apt install -y jq)."
info "Fertig."
