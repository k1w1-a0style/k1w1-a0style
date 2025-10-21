#!/usr/bin/env bash
set -uo pipefail

GREEN="\e[1;32m"; RED="\e[1;31m"; YELLOW="\e[1;33m"
BLUE="\e[1;34m"; CYAN="\e[1;36m"; MAGENTA="\e[1;35m"; NC="\e[0m"

info() { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
ok() { printf "${GREEN}[✓ OK]${NC} %s\n" "$1"; }
bad() { printf "${RED}[✗ FAIL]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[⚠ WARN]${NC} %s\n" "$1"; }
model_info() { printf "${MAGENTA}[MODEL]${NC} %s\n" "$1"; }

SUCCESS_COUNT=0
FAIL_COUNT=0

declare -A GEMINI_KEYS=(
    ["mushrooms4all@gmail.com_1"]="AIzaSyC4LKi3thfdtMx4j5zxyRFJv08uF4JMZ94"
    ["mushrooms4all@gmail.com_2"]="AIzaSyDDHv8HxhhFszsmLp3WPllmHC1OrMrK9p8"
    ["frucht718@gmail.com_1"]="AIzaSyCqPbmm1GcfJ-ghehnPwwqtLxj1yqKfpyk"
    ["frucht718@gmail.com_2"]="AIzaSyCIKitND5wjIVN9TK1P0JIpC5OMwBnjUF8"
    ["pipiundaa38@gmail.com_1"]="AIzaSyDdyaJcpnppiMc9nz09FIoI4arLaPlgTUg"
    ["pipiundaa38@gmail.com_2"]="AIzaSyDh09d9Jp1iKIDUdTY_X_0eCq0rTSMRvmA"
    ["j86528198@gmail.com_1"]="AIzaSyARnu2IVTBcvlH6y5tjKqDHYNI4XFiaT74"
    ["j86528198@gmail.com_2"]="AIzaSyCHGvMlYC1jxeWXBA60kMZI3BiiRonb90A"
    ["p14337191@gmail.com_1"]="AIzaSyBnA4_QC5r6RxK7e6hjziiASPyv7BUu0AM"
    ["p14337191@gmail.com_2"]="AIzaSyCRKjWRyO7BJ-KYd5-3ZqhL4zfMTmS-szA"
    ["k60805975@gmail.com_1"]="AIzaSyDp4CH8N9LItChK7rfeJObIRNS_Hp34x6E"
    ["k60805975@gmail.com_2"]="AIzaSyA4PJOg3H_3x5_9mcZ0_rsNlBUvRbPV5Ik"
)

ANTHROPIC_KEY="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"
OPENAI_KEY="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"
GROQ_KEY="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"

list_gemini_models() {
    model_info "Fetching Gemini models..."
    local data=$(curl -s --max-time 5 "https://generativelanguage.googleapis.com/v1beta/models?key=${1}" 2>/dev/null || echo '{"error":"timeout"}')
    echo "$data" | grep -o '"name":"models/[^"]*"' 2>/dev/null | while IFS= read -r line; do
        echo "$line" | cut -d'"' -f4 | sed 's/^/  • /'
    done | head -15 || echo "  ❌ Failed to fetch"
}

list_anthropic_models() {
    model_info "Anthropic Models"
    echo "  • claude-3-opus-20240229"
    echo "  • claude-3-sonnet-20240229"
    echo "  • claude-3-haiku-20240307"
    echo "  • claude-3-5-sonnet-20241022"
}

list_openai_models() {
    model_info "Fetching OpenAI models..."
    local data=$(curl -s --max-time 5 "https://api.openai.com/v1/models" -H "Authorization: Bearer $1" 2>/dev/null || echo '{"error":"timeout"}')
    echo "$data" | grep -o '"id":"gpt-[^"]*"' 2>/dev/null | while IFS= read -r line; do
        echo "$line" | cut -d'"' -f4 | sed 's/^/  • /'
    done | head -10 || echo "  ❌ Failed"
}

list_groq_models() {
    model_info "Fetching Groq models..."
    local data=$(curl -s --max-time 5 "https://api.groq.com/openai/v1/models" -H "Authorization: Bearer $1" 2>/dev/null || echo '{"error":"timeout"}')
    echo "$data" | grep -o '"id":"[^"]*"' 2>/dev/null | while IFS= read -r line; do
        echo "$line" | cut -d'"' -f4 | sed 's/^/  • /'
    done | head -10 || echo "  ❌ Failed"
}

test_api() {
    local name="$1" url="$2" data="$3"
    shift 3

    printf "${CYAN}----------------------------------------${NC}\n"
    printf "Testing: %s\n" "$name"

    local cmd="curl -s -i --max-time 10 -X POST '$url' -H 'Content-Type: application/json'"
    for arg in "$@"; do
        cmd="$cmd -H '$arg'"
    done
    cmd="$cmd -d '$data'"

    local response=$(eval $cmd 2>/dev/null || echo "HTTP/1.1 000 Timeout")

    local status=$(echo "$response" | grep "HTTP/" | grep -o '[0-9][0-9][0-9]' | head -1)

    if [[ "$status" == "200" ]] || [[ "$status" == "201" ]]; then
        ok "HTTP $status - Success"
        ((SUCCESS_COUNT++))
    else
        bad "HTTP ${status:-000} - Failed"
        ((FAIL_COUNT++))
    fi

    printf "${YELLOW}Rate Limit Headers:${NC}\n"
    local rate_info=$(echo "$response" | grep -i "rate\|limit\|quota" 2>/dev/null | head -3)
    if [[ -n "$rate_info" ]]; then
        echo "$rate_info" | sed 's/^/  /'
    else
        echo "  ℹ None found"
    fi

    printf "${BLUE}Response Body:${NC}\n"
    local body=$(echo "$response" | awk '/^\{/,0' 2>/dev/null | head -8)
    if [[ -n "$body" ]]; then
        echo "$body" | sed 's/^/  /'
    else
        echo "  (empty or non-JSON)"
    fi
    echo ""
}

printf "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
info "🚀 Multi-API Test with Rate Limit Analysis"
printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n\n"

printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
info "🔷 GOOGLE GEMINI - ${#GEMINI_KEYS[@]} Keys"
printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n\n"

list_gemini_models "${GEMINI_KEYS[mushrooms4all@gmail.com_1]}"
echo ""

counter=0
for account in "${!GEMINI_KEYS[@]}"; do
    key="${GEMINI_KEYS[$account]}"
    if ((counter % 3 == 0)); then
        test_api "$account (${key:0:8}...${key: -4})" \
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$key" \
            '{"contents":[{"parts":[{"text":"Hello"}]}]}'
    fi
    ((counter++))
done

printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
info "🔶 ANTHROPIC CLAUDE"
printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n\n"

list_anthropic_models
echo ""

test_api "Claude 3 Haiku" \
    "https://api.anthropic.com/v1/messages" \
    '{"model":"claude-3-haiku-20240307","max_tokens":50,"messages":[{"role":"user","content":"Hello"}]}' \
    "x-api-key: $ANTHROPIC_KEY" \
    "anthropic-version: 2023-06-01"

printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
info "🟢 OPENAI GPT"
printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n\n"

list_openai_models "$OPENAI_KEY"
echo ""

test_api "GPT-3.5-Turbo" \
    "https://api.openai.com/v1/chat/completions" \
    '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}],"max_tokens":20}' \
    "Authorization: Bearer $OPENAI_KEY"

printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
info "🔴 GROQ"
printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n\n"

list_groq_models "$GROQ_KEY"
echo ""

test_api "LLaMA 3.1 8B Instant" \
    "https://api.groq.com/openai/v1/chat/completions" \
    '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Hello"}],"max_tokens":20}' \
    "Authorization: Bearer $GROQ_KEY"

printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
info "📊 Summary"
printf "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n\n"

echo "✅ Success: $SUCCESS_COUNT | ❌ Failed: $FAIL_COUNT"
echo ""
warn "⚠️  REVOKE ALL API KEYS IMMEDIATELY!"
warn "   Gemini: https://aistudio.google.com/app/apikey"
warn "   Anthropic: https://console.anthropic.com/"
warn "   OpenAI: https://platform.openai.com/api-keys"
warn "   Groq: https://console.groq.com/"
