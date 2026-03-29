# Patch 555 — JWT/RBAC-Rollout fuer `trigger-eas-build` + `check-eas-build`

## Kontext

Der naechste eng angrenzende Security-Restblock nach Patch 552/553/554 lag bei den Build-Start/-Status-Routen:

- `supabase/functions/trigger-eas-build/index.ts`
- `supabase/functions/check-eas-build/index.ts`

Beide liefen noch mit Workflow-CI-Bearer-Fallback. In diesem Patch wurden **nur diese zwei Routen** auf den bestehenden kontrollierten JWT+Admin-Key-Vertrag gezogen. `github-run-artifact-json` bleibt bewusst unveraendert.

## Umsetzung

1. Beide Edge-Routen nutzen jetzt:
   - `verify_jwt = true` (in `supabase/config.toml`)
   - `requireScopedEdgeAuth(... allowCiBearer: false, allowJwtAuthHeaderWithAdmin: true, adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY")`
   - `requireJwtRole(... allowedRoles: ["service_role", "authenticated"])`

> Historischer Stand: Die in diesem Patch dokumentierte Rolle `authenticated` wurde in Patch 586 fuer workflow-/build-Operator-Routen durch `build_admin` ersetzt.
2. App-Caller wurden minimal nachgezogen:
   - `project/services/buildStartService.ts`
   - `project/services/buildPollingService.ts`
   - beide holen Session-JWT via `supabase.auth.getSession()`
   - beide senden `Authorization: Bearer <user-jwt>` + `x-k1w1-admin-key`
   - beide blockieren klar bei fehlendem User-JWT (und fehlendem Admin-Key)
3. Direkt betroffene Contract-Checks/Tests wurden auf den neuen Vertrag synchronisiert.

## Geaenderte Dateien

- `supabase/functions/trigger-eas-build/index.ts`
- `supabase/functions/check-eas-build/index.ts`
- `supabase/config.toml`
- `project/services/buildStartService.ts`
- `project/services/buildPollingService.ts`
- `scripts/check_workflow_edge_contracts.sh`
- `__tests__/patch415.edgeAuthGuards.invariants.test.ts`
- `__tests__/buildPollingService.test.ts`
- `__tests__/buildStartService.edgePayloadTyping.test.ts`
- `lib/__tests__/buildStartService.integration.test.ts`
- `__tests__/buildReadinessGate.diagnosticLastOk.test.ts`
- `__tests__/buildReadinessGate.ciLiteFreshness.test.ts`
- `__tests__/buildStartService.readinessContract.test.ts`
- `__tests__/buildReadinessGate.branchMissing.test.ts`
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
