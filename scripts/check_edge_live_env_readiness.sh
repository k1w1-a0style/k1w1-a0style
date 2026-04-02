#!/usr/bin/env bash
set -euo pipefail

missing=()

if [[ -z "${EDGE_BASE_URL:-}" ]]; then
  missing+=("EDGE_BASE_URL")
fi
if [[ -z "${EDGE_OPERATOR_JWT:-}" ]]; then
  missing+=("EDGE_OPERATOR_JWT")
fi

if (( ${#missing[@]} == 0 )); then
  echo "Live-edge env readiness: OK (EDGE_BASE_URL + EDGE_OPERATOR_JWT gesetzt)"
  exit 0
fi

echo "Live-edge env readiness: SKIP (fehlende Variablen: ${missing[*]})"
echo "Hinweis: Fuer echten Live-Vertragslauf setze die fehlenden Variablen und starte scripts/check_release_readiness.sh erneut."
exit 0
