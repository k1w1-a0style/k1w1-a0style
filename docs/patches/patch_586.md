# Patch 586 — Workflow-Operator-RBAC auf `service_role|build_admin` gehaertet

## Ziel

Erster Hardening-Schritt fuer privilegierte workflow-/build-bezogene Edge-Routen: JWT-RBAC auf dem Non-CI-Bearer-Pfad nicht mehr breit mit `authenticated`, sondern fail-closed nur noch mit `service_role` und `build_admin`.

## Geaendert

- `supabase/functions/_shared/auth.ts`
  - Neue Shared-SoT: `WORKFLOW_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"]`.
  - Neuer Wrapper: `requireWorkflowOperatorJwtRole(req, scope)`.
- Folgende Routen nutzen jetzt den Wrapper statt route-lokaler `allowedRoles`-Arrays:
  - `supabase/functions/trigger-eas-build/index.ts`
  - `supabase/functions/check-eas-build/index.ts`
  - `supabase/functions/github-workflow-dispatch/index.ts`
  - `supabase/functions/github-workflow-runs/index.ts`
  - `supabase/functions/github-workflow-logs/index.ts`
  - `supabase/functions/github-run-artifact-json/index.ts`
- Vertrags-/Invariant-Sync:
  - `scripts/check_workflow_edge_contracts.sh`
  - `__tests__/patch415.edgeAuthGuards.invariants.test.ts`
  - `__tests__/patch553.workflowDispatchJwtRbac.invariants.test.ts`
- Doku-Sync:
  - `docs/EDGE_FUNCTIONS_STATUS.md`
  - `docs/04-risk-hotspots.md`
  - `README.md`
  - `PROJECT_CHECKLOG.md`
  - `docs/patches/PATCHLOG_ROOT.md`
  - historische Patch-Hinweise in `patch_553.md` bis `patch_556.md`

## Unveraendert (bewusst)

- CI-Bearer-Flow bleibt aktiv (`allowCiBearer: true`, `ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"`).
- Scoped Admin-Key-Flow bleibt aktiv (`allowJwtAuthHeaderWithAdmin: true`, `adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"`).
- Guard-Reihenfolge bleibt erhalten (`if (!usedCiBearer) { ...JWT role guard... }`).
- `verify_jwt`-Flags in `supabase/config.toml` bleiben unveraendert (bereits korrekt gesetzt).

## Validierung

- `npm run test:silent -- --runInBand __tests__/patch415.edgeAuthGuards.invariants.test.ts __tests__/patch553.workflowDispatchJwtRbac.invariants.test.ts`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
