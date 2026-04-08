#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
SKIP_COUNT=0

echo "[verify:release] docs lint"
node scripts/docsLint.js

echo "[verify:release] docs contract check"
node scripts/check_docs_contracts.js

echo "[verify:release] patch/docs sync"
bash scripts/check_patch_docs_sync.sh

if [[ -f "node_modules/expo/tsconfig.base.json" ]]; then
  echo "[verify:release] app typecheck"
  npm run -s typecheck
else
  echo "[verify:release] skip app typecheck (node_modules/expo/tsconfig.base.json fehlt im aktuellen Workspace)"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

echo "[verify:release] strict typecheck"
tsc -p tsconfig.strict.json --noEmit --noUnusedLocals --noUnusedParameters

echo "[verify:release] edge typecheck"
tsc -p supabase/functions/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters

echo "[verify:release] workflow template drift"
bash scripts/check_workflow_template_drift.sh

echo "[verify:release] managed workflows"
bash scripts/check_managed_workflows.sh

echo "[verify:release] supabase deploy workflow"
bash scripts/check_supabase_deploy_workflow.sh

echo "[verify:release] EAS manual trigger controls"
bash scripts/check_eas_manual_trigger_controls.sh

echo "[verify:release] EAS production credentials"
bash scripts/check_eas_production_credentials.sh

echo "[verify:release] EAS strict lockfile policy"
bash scripts/check_eas_strict_lockfile_policy.sh

echo "[verify:release] workflow/edge contracts"
bash scripts/check_workflow_edge_contracts.sh

echo "[verify:release] verify_jwt visibility"
bash scripts/check_verify_jwt_visibility.sh

echo "[verify:release] edge rate-limit retention"
bash scripts/check_edge_rate_limit_retention.sh

echo "[verify:release] legacy disabled edges"
bash scripts/check_legacy_disabled_edges.sh

echo "[verify:release] k1w1 provider contracts"
bash scripts/check_k1w1_handler_providers.sh

echo "[verify:release] edge helper visibility"
bash scripts/check_edge_helper_visibility.sh

echo "[verify:release] supabase RLS hardening"
bash scripts/check_supabase_rls_hardening.sh

echo "[verify:release] live edge env readiness"
bash scripts/check_edge_live_env_readiness.sh

if [[ -n "${EDGE_BASE_URL:-}" && -n "${EDGE_OPERATOR_JWT:-}" ]]; then
  echo "[verify:release] live edge contracts"
  bash scripts/check_edge_live_contracts.sh
  echo "[verify:release] reminder: verify_jwt live flags for save_preview + k1w1-handler require explicit operator audit (behavior checks alone are not sufficient)"
else
  echo "[verify:release] skip live edge contracts (EDGE_BASE_URL / EDGE_OPERATOR_JWT not set)"
  SKIP_COUNT=$((SKIP_COUNT + 1))
fi

if [[ "$SKIP_COUNT" -gt 0 ]]; then
  echo "[verify:release] OK_WITH_SKIPS ($SKIP_COUNT checks skipped; partial/local evidence only, not full release sign-off)"
else
  echo "[verify:release] OK_FULL"
fi
