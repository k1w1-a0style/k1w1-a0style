#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${K1W1_EDGE_ENV_FILE:-.env.edge.live}"

mask(){
  local v="${1:-}" n=${#1}
  [[ ${#v} -eq 0 ]] && { echo missing; return; }
  [[ ${#v} -le 8 ]] && { echo "set(len=${#v})"; return; }
  echo "${v:0:4}...${v: -4} (len=${#v})"
}

trim(){
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

unquote(){
  local s
  s="$(trim "$1")"
  s="${s%$'\r'}"
  if [[ "${s:0:1}" == '"' && "${s: -1}" == '"' ]]; then
    s="${s:1:${#s}-2}"
  elif [[ "${s:0:1}" == "'" && "${s: -1}" == "'" ]]; then
    s="${s:1:${#s}-2}"
  fi
  printf '%s' "$s"
}

load_env_file_defaults(){
  local file="$1"
  [[ -f "$file" ]] || return 0

  local line key raw value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*export[[:space:]]+ ]] && line="${line#export }"
    [[ "$line" == *"="* ]] || continue
    key="$(trim "${line%%=*}")"
    raw="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    [[ -n "${!key:-}" ]] && continue
    value="$(unquote "$raw")"
    [[ -z "$value" ]] && continue
    export "$key=$value"
  done < "$file"
}

copy_if_missing(){
  local target="$1" source="$2"
  [[ -n "${!target:-}" ]] && return 0
  [[ -n "${!source:-}" ]] || return 0
  export "$target=${!source}"
}

derive_env_defaults(){
  copy_if_missing SUPABASE_URL K1W1_SUPABASE_URL
  copy_if_missing SUPABASE_URL EXPO_PUBLIC_SUPABASE_URL
  copy_if_missing SUPABASE_ANON_KEY EXPO_PUBLIC_SUPABASE_ANON_KEY
  copy_if_missing EDGE_OPERATOR_JWT K1W1_EDGE_WORKFLOW_JWT
  copy_if_missing EDGE_BASE_URL EXPO_PUBLIC_SUPABASE_EDGE_URL

  if [[ -z "${EDGE_BASE_URL:-}" ]]; then
    if [[ -n "${SUPABASE_URL:-}" ]]; then
      EDGE_BASE_URL="${SUPABASE_URL%/}/functions/v1"
      export EDGE_BASE_URL
    elif [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
      EDGE_BASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1"
      export EDGE_BASE_URL
    fi
  fi
}

load_env_file_defaults "$ENV_FILE"
derive_env_defaults

req=(EDGE_BASE_URL SUPABASE_ANON_KEY K1W1_EDGE_WORKFLOW_ADMIN_KEY K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY)
missing=0
for k in "${req[@]}"; do
  if [[ -z "${!k:-}" ]]; then
    echo "missing env: $k"
    missing=1
  fi
done
if [[ $missing -ne 0 ]]; then
  echo "hint: shell env wins; $ENV_FILE is loaded only as fallback; EDGE_BASE_URL can be derived from SUPABASE_URL or SUPABASE_PROJECT_REF."
  exit 2
fi

echo "live auth doctor (sanitized)"
echo "EDGE_BASE_URL=$(mask "$EDGE_BASE_URL")"

call_route(){
  local route="$1" mode="$2" admin="$3" payload="$4"
  local auth="$SUPABASE_ANON_KEY"
  [[ "$mode" == "jwt" ]] && auth="${EDGE_OPERATOR_JWT:-}"
  local start end ms code body rc
  start=$(date +%s%3N)
  body="$(mktemp)"
  set +e
  code=$(curl -sS -m 20 -o "$body" -w "%{http_code}" \
    -H "Authorization: Bearer ${auth}" \
    -H "Content-Type: application/json" \
    ${admin:+-H "x-k1w1-admin-key: ${admin}"} \
    -d "$payload" "${EDGE_BASE_URL%/}/${route}")
  rc=$?
  set -e
  end=$(date +%s%3N); ms=$((end-start))
  local diag="ok" ok="ok"
  if [[ $rc -ne 0 ]]; then diag="timeout/network"; ok="fail"; code="000"; fi
  if [[ "$code" == "401" || "$code" == "403" ]]; then diag="auth rejected"; ok="fail"; fi
  if [[ "$code" == "404" ]]; then diag="route not deployed"; ok="fail"; fi
  if [[ "$code" == "422" ]]; then diag="payload invalid/too large"; ok="fail"; fi
  if [[ "$code" =~ ^5[0-9][0-9]$ ]]; then diag="server error"; ok="fail"; fi
  printf "%-28s | %-13s | %-4s | %-5s | %-4s | %s\n" "$route" "$mode" "$code" "$ms" "$ok" "$diag"
  rm -f "$body"
  [[ "$ok" == "ok" ]]
}

printf "%-28s | %-13s | %-4s | %-5s | %-4s | %s\n" route mode code ms ok diagnosis
printf '%s\n' "--------------------------------------------------------------------------------------"
fail=0
call_route save_preview ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"files":{"App.tsx":"export default function App(){return null;}"}}' || fail=1
call_route github-workflow-runs ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"githubRepo":"k1w1-a0style/musik-player"}' || fail=1
call_route android-keystore-status ownerFallback "$K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY" '{"mode":"development","profile":"development"}' || fail=1
if [[ -n "${EDGE_OPERATOR_JWT:-}" ]]; then
  call_route save_preview jwt "" '{"files":{"App.tsx":"export default function App(){return null;}"}}' || true
fi

if [[ "${K1W1_LIVE_MUTATION_TESTS:-false}" == "true" ]]; then
  call_route github-workflow-dispatch ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"workflow":"ci-lite.yml","githubRepo":"k1w1-a0style/musik-player","branch":"main"}' || true
fi

exit $fail
