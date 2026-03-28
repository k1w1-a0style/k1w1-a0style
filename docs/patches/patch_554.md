# Patch 554 — JWT/RBAC-Rollout fuer `github-workflow-runs` + `github-workflow-logs`

## Ziel

Naechsten eng angrenzenden Read-/Support-Block nach den Piloten (`android-keystore-export`, `github-workflow-dispatch`) kontrolliert auf denselben JWT+Admin-Key-Vertrag ziehen, **ohne** Migration der gesamten Workflow-Familie.

## Geaendert

- `supabase/functions/github-workflow-runs/index.ts`
  - Auth auf `allowCiBearer: false` + `allowJwtAuthHeaderWithAdmin: true` umgestellt.
  - Serverseitigen Claim-Guard `requireJwtRole(... allowedRoles: ["service_role", "authenticated"])` ergaenzt.

> Historischer Stand: Der damalige `authenticated`-Vertrag wurde spaeter in Patch 586 fuer diese Operator-Routen auf `service_role|build_admin` gehaertet.
- `supabase/functions/github-workflow-logs/index.ts`
  - Auth auf `allowCiBearer: false` + `allowJwtAuthHeaderWithAdmin: true` umgestellt.
  - Serverseitigen Claim-Guard `requireJwtRole(... allowedRoles: ["service_role", "authenticated"])` ergaenzt.
- `supabase/config.toml`
  - `functions.github-workflow-runs.verify_jwt = true`.
  - `functions.github-workflow-logs.verify_jwt = true`.
  - Security-Kommentar auf den neuen Pilot-Stand aktualisiert.
- Caller-Sync (minimal):
  - `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`: Run-Lookup sendet jetzt JWT + `x-k1w1-admin-key` (wie Dispatch).
  - `hooks/useGitHubActionsLogs.ts`: Runs-/Logs-Lookups senden jetzt JWT + `x-k1w1-admin-key`.
- Invariants / Contracts:
  - `__tests__/patch553.workflowDispatchJwtRbac.invariants.test.ts` um Runs/Logs-Haertung erweitert.
  - `__tests__/useCiLiteWorkflow.behavior.test.tsx` um Header-Check fuer Run-Lookup erweitert.
  - `__tests__/useGitHubActionsLogs.contract.test.tsx` auf JWT+Admin-Header bei Runs/Logs erweitert.
  - `scripts/check_workflow_edge_contracts.sh` auf neuen Runs/Logs-Auth-Vertrag angepasst.
  - `docs/EDGE_FUNCTIONS_STATUS.md` Auth-Vertrag fuer Runs/Logs aktualisiert.

## Validierung

- `npm run typecheck`
- `npm run edge:check`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_patch_docs_sync.sh`
