#!/usr/bin/env bash
set -euo pipefail
[[ -f .env.edge.live ]] && source .env.edge.live

mask(){ local v="${1:-}"; local n=${#v}; [[ $n -eq 0 ]] && { echo missing; return; }; echo "${v:0:4}...${v: -4} (len=$n)"; }
req=(EDGE_BASE_URL SUPABASE_ANON_KEY K1W1_EDGE_WORKFLOW_ADMIN_KEY K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY)
for k in "${req[@]}"; do [[ -z "${!k:-}" ]] && { echo "missing env: $k"; exit 2; }; done

echo "live auth doctor (sanitized)"
echo "EDGE_BASE_URL=$(mask "$EDGE_BASE_URL")"

call_route(){
  local route="$1" mode="$2" admin="$3" payload="$4"
  local auth="$SUPABASE_ANON_KEY"
  [[ "$mode" == "jwt" ]] && auth="${EDGE_OPERATOR_JWT:-}"
  local start end ms code
  start=$(date +%s%3N)
  set +e
  code=$(curl -sS -m 20 -o /tmp/k1w1-body.json -w "%{http_code}" \
    -H "Authorization: Bearer ${auth}" \
    -H "Content-Type: application/json" \
    ${admin:+-H "x-k1w1-admin-key: ${admin}"} \
    -d "$payload" "${EDGE_BASE_URL%/}/${route}")
  local rc=$?
  set -e
  end=$(date +%s%3N); ms=$((end-start))
  local diag="ok" ok="ok"
  if [[ $rc -ne 0 ]]; then diag="timeout"; ok="fail"; code="000"; fi
  if [[ "$code" == "401" || "$code" == "403" ]]; then diag="auth rejected"; ok="fail"; fi
  if [[ "$code" == "404" ]]; then diag="route not deployed"; ok="fail"; fi
  printf "%-28s | %-13s | %-4s | %-5s | %-4s | %s\n" "$route" "$mode" "$code" "$ms" "$ok" "$diag"
  [[ "$ok" == "ok" ]]
}

printf "%-28s | %-13s | %-4s | %-5s | %-4s | %s\n" route mode code ms ok diagnosis
printf '%s
' "--------------------------------------------------------------------------------------"
fail=0
call_route save_preview ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"files":{"App.tsx":"export default 1"}}' || fail=1
call_route github-workflow-runs ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"githubRepo":"owner/repo"}' || fail=1
call_route android-keystore-status ownerFallback "$K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY" '{"profile":"development"}' || fail=1
if [[ -n "${EDGE_OPERATOR_JWT:-}" ]]; then
  call_route save_preview jwt "" '{"files":{"App.tsx":"export default 1"}}' || true
fi

if [[ "${K1W1_LIVE_MUTATION_TESTS:-false}" == "true" ]]; then
  call_route github-workflow-dispatch ownerFallback "$K1W1_EDGE_WORKFLOW_ADMIN_KEY" '{"workflow":"ci-lite.yml"}' || true
fi

exit $fail
