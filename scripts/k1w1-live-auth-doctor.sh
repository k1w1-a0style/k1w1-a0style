#!/usr/bin/env bash
set -euo pipefail

is_empty() { [[ -z "${1:-}" ]]; }
set_if_empty_from_file() {
  local key="$1" val="$2"
  if [[ -n "$val" ]] && is_empty "${!key:-}"; then
    export "$key=$val"
  fi
}

if [[ -f .env.edge.live ]]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    line="${line#export }"
    key="${line%%=*}"; raw="${line#*=}"
    key="$(echo "$key" | xargs)"
    raw="${raw%$'\r'}"
    raw="${raw%\"}"; raw="${raw#\"}"; raw="${raw%\'}"; raw="${raw#\'}"
    set_if_empty_from_file "$key" "$raw"
  done < .env.edge.live
fi

# derive edge base url if missing
if is_empty "${EDGE_BASE_URL:-}"; then
  if [[ -n "${EXPO_PUBLIC_SUPABASE_EDGE_URL:-}" ]]; then
    export EDGE_BASE_URL="${EXPO_PUBLIC_SUPABASE_EDGE_URL}"
  elif [[ -n "${SUPABASE_URL:-}" ]]; then
    export EDGE_BASE_URL="${SUPABASE_URL%/}/functions/v1"
  elif [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
    export EDGE_BASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1"
  fi
fi

mask(){ local v="${1:-}"; local n=${#v}; [[ $n -eq 0 ]] && { echo missing; return; }; [[ $n -le 8 ]] && { echo "set(len=$n)"; return; }; echo "${v:0:4}...${v: -4} (len=$n)"; }

required=(EDGE_BASE_URL SUPABASE_ANON_KEY K1W1_EDGE_WORKFLOW_ADMIN_KEY K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY)
for k in "${required[@]}"; do [[ -z "${!k:-}" ]] && { echo "missing env: $k"; exit 2; }; done

echo "live auth doctor (sanitized)"
echo "EDGE_BASE_URL=$(mask "$EDGE_BASE_URL") derived=$([[ -n "${EXPO_PUBLIC_SUPABASE_EDGE_URL:-}${SUPABASE_URL:-}${SUPABASE_PROJECT_REF:-}" ]] && echo possible || echo no)"

call_route(){
  local route="$1" mode="$2" admin="$3" payload="$4"
  local auth="$SUPABASE_ANON_KEY"
  [[ "$mode" == "jwt" ]] && auth="${EDGE_OPERATOR_JWT:-}"
  local start end ms code rc diag="ok" ok="ok"
  start=$(date +%s%3N)
  set +e
  code=$(curl -sS -m 20 -o /tmp/k1w1-body.json -w "%{http_code}" \
    -H "Authorization: Bearer ${auth}" -H "Content-Type: application/json" \
    ${admin:+-H "x-k1w1-admin-key: ${admin}"} -d "$payload" "${EDGE_BASE_URL%/}/${route}")
  rc=$?
  set -e
  end=$(date +%s%3N); ms=$((end-start))
  if [[ $rc -ne 0 ]]; then diag="timeout"; ok="fail"; code="000"; fi
  [[ "$code" =~ ^(401|403)$ ]] && { diag="auth rejected"; ok="fail"; }
  [[ "$code" == "404" ]] && { diag="route not deployed"; ok="fail"; }
  [[ "$code" == "422" ]] && { diag="payload invalid/too large"; ok="fail"; }
  [[ "$code" =~ ^5[0-9][0-9]$ ]] && { diag="server error"; ok="fail"; }
  printf "%-28s | %-13s | %-4s | %-5s | %-4s | %s\n" "$route" "$mode" "$code" "$ms" "$ok" "$diag"
  [[ "$ok" == "ok" ]]
}

printf "%-28s | %-13s | %-4s | %-5s | %-4s | %s\n" route mode code ms ok diagnosis
printf '%s\n' "--------------------------------------------------------------------------------------"
fail=0
call_route save_preview ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"files":{"App.tsx":"export default 1"}}' || fail=1
call_route github-workflow-runs ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"githubRepo":"owner/repo"}' || fail=1
call_route android-keystore-status ownerFallback "$K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY" '{"profile":"development"}' || fail=1
if [[ -n "${EDGE_OPERATOR_JWT:-}" ]]; then
  call_route save_preview jwt "" '{"files":{"App.tsx":"export default 1"}}' || true
fi
[[ "${K1W1_LIVE_MUTATION_TESTS:-false}" == "true" ]] && call_route github-workflow-dispatch ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"workflow":"ci-lite.yml"}' || true
exit $fail
