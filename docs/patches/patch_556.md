# Patch 556 — JWT/RBAC-Restblock fuer `github-run-artifact-json` + Caller-Fail-Fast

## Kontext

Nach Patch 552/553/554/555 blieb in der Workflow-Familie als groesster Restblock:

- `supabase/functions/github-run-artifact-json/index.ts`

Zusaetzlich war der Clientvertrag fuer Runs/Logs in `hooks/useGitHubActionsLogs.ts` noch unsauber, weil der Admin-Key dort als optionaler Header gesendet werden konnte.

## Umsetzung

1. `github-run-artifact-json` auf denselben kontrollierten Vertrag gezogen:
   - `verify_jwt = true` in `supabase/config.toml`
   - `requireScopedEdgeAuth(... allowAdmin: true, allowCiBearer: false, allowJwtAuthHeaderWithAdmin: true, adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY")`
   - danach `requireJwtRole(... allowedRoles: ["service_role", "authenticated"])`
2. Direkten Artifact-Caller minimal synchronisiert (`useCiLiteWorkflow`):
   - Session-JWT via `supabase.auth.getSession()`
   - Header jetzt immer `Authorization: Bearer <user-jwt>` + `x-k1w1-admin-key`
   - klarer lokaler Block bei fehlendem JWT oder fehlendem/ungueltigem Admin-Key
3. Runs/Logs-Caller lokal fail-fast nachgeschaerft (`useGitHubActionsLogs`):
   - kein optionaler Admin-Key-Header mehr
   - klarer lokaler Block bei fehlendem Admin-Key, bevor Requests gesendet werden
4. Direkt betroffene Contracts/Tests/Doku synchronisiert.

## Geaenderte Dateien

- `supabase/functions/github-run-artifact-json/index.ts`
- `supabase/config.toml`
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
- `hooks/useGitHubActionsLogs.ts`
- `scripts/check_workflow_edge_contracts.sh`
- `__tests__/patch415.edgeAuthGuards.invariants.test.ts`
- `__tests__/useCiLiteWorkflow.behavior.test.tsx`
- `__tests__/useGitHubActionsLogs.contract.test.tsx`
- `docs/EDGE_FUNCTIONS_STATUS.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
- `README.md`

## Validierung

- `npm run typecheck`
- `npm run edge:check`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `git diff --check`
