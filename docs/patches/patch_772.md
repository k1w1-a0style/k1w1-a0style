# Patch 772 — EdgeAuthRateLimitConnectionsHardening

## Scope
- Shared Edge Auth hardening (`requireJwtRole`, `requireScopedEdgeAuth`, rate-limit subject trust boundary).
- Connections hook contract split into grouped return sections.
- Drift-sensitive invariant/execution checks aligned with real `routeCore` paths.

## Changes
- `supabase/functions/_shared/auth/jwt.ts`
  - `requireJwtRole(...)` reads role only from a verified context object produced in the same verification path.
- `supabase/functions/_shared/auth/scoped.ts`
  - removed misleading optional mixed-mode toggle; scoped routes require valid `x-k1w1-admin-key`, bearer-only stays rejected.
- `supabase/functions/_shared/auth/rateLimit.ts`
  - `x-forwarded-for` is only used when an explicit trusted proxy boundary is present.
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
  - returns grouped contracts (`ui`, `connection`, `tokens`, `visibility`, `supabase`, `eas`, `actions`) instead of a wide flat facade.
- Invariant/shell checks and related tests were updated to validate the executable `routeCore` contract paths.

## Validation
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_eas_manual_trigger_controls.sh`
- `bash scripts/check_eas_production_credentials.sh`
- `bash scripts/check_eas_strict_lockfile_policy.sh`
- `bash scripts/check_edge_helper_visibility.sh`
- `bash scripts/check_k1w1_handler_providers.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_supabase_deploy_workflow.sh`
