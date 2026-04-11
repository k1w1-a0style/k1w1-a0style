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
  if looks_like_jwt "${SUPABASE_SERVICE_ROLE_KEY:-}"; then
    export EDGE_OPERATOR_JWT="${SUPABASE_SERVICE_ROLE_KEY}"
  fi
fi

if ! looks_like_jwt "${EDGE_OPERATOR_JWT:-}"; then
  echo "Missing valid EDGE_OPERATOR_JWT and no usable SUPABASE_SERVICE_ROLE_KEY fallback found." >&2
  exit 1
fi

echo "Live-edge env readiness: OK (EDGE_BASE_URL + usable operator JWT vorhanden)"
