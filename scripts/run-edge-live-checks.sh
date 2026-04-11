#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env.edge.live" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.edge.live
  set +a
fi

if [[ -z "${EDGE_OPERATOR_JWT:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  export EDGE_OPERATOR_JWT="${SUPABASE_SERVICE_ROLE_KEY}"
fi

echo "[edge-live] env readiness"
bash scripts/check_edge_live_env_readiness.sh

echo "[edge-live] live contracts"
bash scripts/check_edge_live_contracts.sh

echo "[edge-live] release readiness"
bash scripts/check_release_readiness.sh
