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
echo "Minimal erforderlich (Live-Checks): EDGE_BASE_URL, EDGE_OPERATOR_JWT"
echo "Lokaler Lauf (nur fuer aktuelle Shell):"
echo "  export EDGE_BASE_URL=\"https://<project>.supabase.co/functions/v1\""
echo "  export EDGE_OPERATOR_JWT=\"<frischer build_admin jwt>\""
echo "  bash scripts/check_edge_live_contracts.sh"
echo "CI/Runner: Werte als Secret/Masked Env setzen, nicht in Dateien committen."
exit 0
