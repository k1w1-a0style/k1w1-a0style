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

if is_empty "${EDGE_BASE_URL:-}"; then
  if [[ -n "${EXPO_PUBLIC_SUPABASE_EDGE_URL:-}" ]]; then
    export EDGE_BASE_URL="${EXPO_PUBLIC_SUPABASE_EDGE_URL}"
  elif [[ -n "${SUPABASE_URL:-}" ]]; then
    export EDGE_BASE_URL="${SUPABASE_URL%/}/functions/v1"
  elif [[ -n "${K1W1_SUPABASE_URL:-}" ]]; then
    export EDGE_BASE_URL="${K1W1_SUPABASE_URL%/}/functions/v1"
  elif [[ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" ]]; then
    export EDGE_BASE_URL="${EXPO_PUBLIC_SUPABASE_URL%/}/functions/v1"
  elif [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
    export EDGE_BASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1"
  fi
fi

TARGET_GITHUB_REPO="${GITHUB_REPO_FULL_NAME:-k1w1-a0style/musik-player}"
TARGET_GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

mask(){ local v="${1:-}"; local n=${#v}; [[ $n -eq 0 ]] && { echo missing; return; }; [[ $n -le 8 ]] && { echo "set(len=$n)"; return; }; echo "${v:0:4}...${v: -4} (len=$n)"; }

required=(EDGE_BASE_URL SUPABASE_ANON_KEY K1W1_EDGE_WORKFLOW_ADMIN_KEY K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY)
for k in "${required[@]}"; do [[ -z "${!k:-}" ]] && { echo "missing env: $k"; exit 2; }; done

echo "live auth doctor (sanitized)"
echo "EDGE_BASE_URL=$(mask "$EDGE_BASE_URL")"
echo "GITHUB_REPO_FULL_NAME=$TARGET_GITHUB_REPO"
echo "GITHUB_BRANCH=$TARGET_GITHUB_BRANCH"

classify_status() {
  local code="$1"
  if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    echo "ok"
  elif [[ "$code" == "000" ]]; then
    echo "timeout/network"
  elif [[ "$code" == "400" ]]; then
    echo "payload invalid / bad request"
  elif [[ "$code" == "401" || "$code" == "403" ]]; then
    echo "auth rejected"
  elif [[ "$code" == "404" ]]; then
    echo "route not deployed"
  elif [[ "$code" == "409" ]]; then
    echo "conflict"
  elif [[ "$code" == "422" ]]; then
    echo "payload invalid/too large"
  elif [[ "$code" == "429" ]]; then
    echo "rate limited"
  elif [[ "$code" =~ ^5[0-9][0-9]$ ]]; then
    echo "server error"
  else
    echo "http error"
  fi
}

call_route(){
  local route="$1" mode="$2" admin="$3" payload="$4"
  local auth="$SUPABASE_ANON_KEY"
  [[ "$mode" == "jwt" ]] && auth="${EDGE_OPERATOR_JWT:-}"
  local start end ms code rc diagnosis ok
  start=$(date +%s%3N)
  set +e
  code=$(curl -sS -m 20 -o /tmp/k1w1-body.json -w "%{http_code}" \
    -H "Authorization: Bearer ${auth}" -H "Content-Type: application/json" \
    ${admin:+-H "x-k1w1-admin-key: ${admin}"} -d "$payload" "${EDGE_BASE_URL%/}/${route}")
  rc=$?
  set -e
  end=$(date +%s%3N); ms=$((end-start))
  if [[ $rc -ne 0 ]]; then code="000"; fi
  diagnosis="$(classify_status "$code")"
  ok="fail"
  [[ "$code" =~ ^2[0-9][0-9]$ ]] && ok="ok"
  printf "%-28s | %-13s | %-4s | %-5s | %-4s | %s\n" "$route" "$mode" "$code" "$ms" "$ok" "$diagnosis"
  [[ "$ok" == "ok" ]]
}

printf "%-28s | %-13s | %-4s | %-5s | %-4s | %s\n" route mode code ms ok diagnosis
printf '%s\n' "--------------------------------------------------------------------------------------"
fail=0
call_route save_preview ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"githubRepo":"'"$TARGET_GITHUB_REPO"'","branch":"'"$TARGET_GITHUB_BRANCH"'","files":{"App.tsx":"import React from \"react\";\nimport { Text, View } from \"react-native\";\n\nexport default function App(): JSX.Element {\n  return (\n    <View><Text>Hello from preview</Text></View>\n  );\n}\n"}}' || fail=1
call_route github-workflow-runs ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"githubRepo":"'"$TARGET_GITHUB_REPO"'"}' || fail=1
call_route android-keystore-status ownerFallback "$K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY" '{"githubRepo":"'"$TARGET_GITHUB_REPO"'","profile":"development"}' || fail=1
if [[ -n "${EDGE_OPERATOR_JWT:-}" ]]; then
  call_route save_preview jwt "" '{"githubRepo":"'"$TARGET_GITHUB_REPO"'","branch":"'"$TARGET_GITHUB_BRANCH"'","files":{"App.tsx":"import React from \"react\";\nexport default function App(){ return null; }\n"}}' || fail=1
fi
if [[ "${K1W1_LIVE_MUTATION_TESTS:-false}" == "true" ]]; then
  call_route github-workflow-dispatch ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"githubRepo":"'"$TARGET_GITHUB_REPO"'","branch":"'"$TARGET_GITHUB_BRANCH"'","workflow":"ci-lite.yml"}' || fail=1
fi
exit $fail
