# Patch 553 — JWT/RBAC-Pilot fuer `github-workflow-dispatch`

## Ziel

Naechster kontrollierter JWT-/RBAC-Rollout nach dem erfolgreichen `android-keystore-export`-Pilot, **ohne** globale Workflow-Familien-Migration.

## Geaendert

- `supabase/functions/github-workflow-dispatch/index.ts`
  - Route auf JWT+Claim-Gate erweitert (`requireJwtRole(...)`).
  - Scoped Route-Auth fuer Dispatch auf `allowCiBearer: false` + `allowJwtAuthHeaderWithAdmin: true` umgestellt.
  - Erlaubte Claims explizit verengt auf: `service_role`, `authenticated` (kein `anon` mehr).
- `supabase/config.toml`
  - `functions.github-workflow-dispatch.verify_jwt = true`.
  - Sicherheitskommentar fuer den neuen Pilot-Stand aktualisiert.
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
  - Dispatch-Caller sendet jetzt einen echten Supabase-Session-JWT (`role=authenticated`) via `Authorization: Bearer <user-jwt>` (neben `x-k1w1-admin-key`).
  - Klarer Blocker, wenn kein gueltiger User-Login/JWT verfuegbar ist.
- Invariants / Contract-Sync:
  - `__tests__/patch553.workflowDispatchJwtRbac.invariants.test.ts` neu.
  - `__tests__/patch415.edgeAuthGuards.invariants.test.ts` auf den neuen Dispatch-Vertrag angepasst.
  - `__tests__/useCiLiteWorkflow.behavior.test.tsx` auf JWT+Admin-Header beim Dispatch angepasst.
  - `scripts/check_workflow_edge_contracts.sh` auf neuen Dispatch-Auth-Vertrag angepasst.
  - `docs/EDGE_FUNCTIONS_STATUS.md` Dispatch-Auth auf JWT+Claim+Scoped-Secret aktualisiert.

## Validierung

- `npm run typecheck`
- `npm run edge:check`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
