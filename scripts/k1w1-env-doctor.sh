#!/usr/bin/env bash
set -euo pipefail

mask() {
  local v="${1:-}"
  local n=${#v}
  if [[ $n -eq 0 ]]; then echo "missing"; return; fi
  if [[ $n -le 8 ]]; then echo "set(len=$n)"; return; fi
  echo "${v:0:4}...${v: -4} (len=$n)"
}

print_var(){
  local k="$1"; local v="${!k:-}"
  if [[ -n "$v" ]]; then
    printf "%-45s present  %s\n" "$k" "$(mask "$v")"
  else
    printf "%-45s missing  -\n" "$k"
  fi
}

compare_equal(){
  local a="$1" b="$2" c="$3"
  local va="${!a:-}" vb="${!b:-}" vc="${!c:-}"
  if [[ -z "$va" || -z "$vb" || -z "$vc" ]]; then
    echo "[warn] alias check skipped ($a/$b/$c missing)"
    return
  fi
  if [[ "$va" == "$vb" && "$vb" == "$vc" ]]; then
    echo "[ok] $a == $b == $c"
  else
    echo "[fail] alias mismatch in $a/$b/$c"
  fi
}

echo "k1w1 env doctor (sanitized)"
vars=(
SUPABASE_PROJECT_REF SUPABASE_URL K1W1_SUPABASE_URL EXPO_PUBLIC_SUPABASE_URL EDGE_BASE_URL EXPO_PUBLIC_SUPABASE_EDGE_URL
SUPABASE_ANON_KEY EXPO_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY K1W1_SUPABASE_SERVICE_ROLE_KEY
GITHUB_TOKEN EXPO_TOKEN K1W1_EDGE_WORKFLOW_ADMIN_KEY K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY K1W1_EDGE_ADMIN_KEY
SIGNING_ADMIN_KEY SIGNING_MASTER_KEY EDGE_OPERATOR_JWT K1W1_EDGE_WORKFLOW_JWT
)
for k in "${vars[@]}"; do print_var "$k"; done

echo "\nAlias checks"
compare_equal SUPABASE_URL K1W1_SUPABASE_URL EXPO_PUBLIC_SUPABASE_URL
if [[ -n "${SUPABASE_ANON_KEY:-}" && -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  [[ "$SUPABASE_ANON_KEY" == "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]] && echo "[ok] SUPABASE_ANON_KEY alias match" || echo "[fail] SUPABASE_ANON_KEY alias mismatch"
fi
if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" && -n "${K1W1_SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  [[ "$SUPABASE_SERVICE_ROLE_KEY" == "$K1W1_SUPABASE_SERVICE_ROLE_KEY" ]] && echo "[ok] SERVICE_ROLE alias match" || echo "[fail] SERVICE_ROLE alias mismatch"
fi
if [[ -n "${EDGE_OPERATOR_JWT:-}" && -n "${K1W1_EDGE_WORKFLOW_JWT:-}" ]]; then
  [[ "$EDGE_OPERATOR_JWT" == "$K1W1_EDGE_WORKFLOW_JWT" ]] && echo "[ok] OPERATOR JWT alias match" || echo "[fail] OPERATOR JWT alias mismatch"
fi

if [[ -n "${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-}" && -n "${K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY:-}" ]]; then
  if [[ "${K1W1_EDGE_WORKFLOW_ADMIN_KEY}" == "${K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY}" ]]; then
    echo "[warn] scoped admin keys are identical (verify this is intentional)"
  else
    echo "[ok] scoped admin keys differ"
  fi
fi
