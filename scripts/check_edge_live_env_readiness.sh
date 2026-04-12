#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env.edge.live" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.edge.live
  set +a
fi

looks_like_jwt() {
  local token="${1:-}"
  [[ -n "$token" && "$token" == *.*.* ]]
}

derive_supabase_origin() {
  local edge_url="${1:-}"
  edge_url="${edge_url%/}"
  printf '%s' "${edge_url%/functions/v1}"
}

if [[ -z "${EDGE_BASE_URL:-}" ]]; then
  echo "Missing EDGE_BASE_URL (expected: https://<project>.supabase.co/functions/v1)" >&2
  exit 1
fi

if ! [[ "${EDGE_BASE_URL}" =~ ^https://[^[:space:]]+/functions/v1/?$ ]]; then
  echo "Invalid EDGE_BASE_URL: ${EDGE_BASE_URL}" >&2
  echo "Expected something like: https://xfgnzpcljsuqqdjlxgul.supabase.co/functions/v1" >&2
  exit 1
fi

if ! looks_like_jwt "${EDGE_OPERATOR_JWT:-}"; then
  echo "Missing valid EDGE_OPERATOR_JWT (expected Bearer JWT for operator route auth)." >&2
  exit 1
fi

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  SUPABASE_ORIGIN="$(derive_supabase_origin "${EDGE_BASE_URL}")"
  AUTH_TMP_BODY="$(mktemp)"
  trap 'rm -f "$AUTH_TMP_BODY"' EXIT
  AUTH_CHECK_STATUS="$(
    curl -sS -o "$AUTH_TMP_BODY" -w "%{http_code}" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${EDGE_OPERATOR_JWT}" \
      "${SUPABASE_ORIGIN}/auth/v1/user"
  )"

  if [[ "${AUTH_CHECK_STATUS}" != "200" ]]; then
    echo "EDGE_OPERATOR_JWT preflight failed against ${SUPABASE_ORIGIN}/auth/v1/user (HTTP ${AUTH_CHECK_STATUS})." >&2
    echo "The token is missing, malformed, expired, or unverifiable for Supabase Auth." >&2
    exit 1
  fi

  echo "Live-edge env readiness: OK (EDGE_BASE_URL + verified EDGE_OPERATOR_JWT preflight)"
  exit 0
fi

echo "Live-edge env readiness: SKIP (EDGE_BASE_URL + EDGE_OPERATOR_JWT present; preflight skipped because SUPABASE_SERVICE_ROLE_KEY is not set)"
