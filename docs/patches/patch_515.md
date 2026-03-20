# Patch 515: GitHub-PAT-Passthrough aus Client→Edge-Workflowpfaden entfernt

## Ziel

Den verbliebenen GitHub-Token-Transport vom Client in Edge-Functions fuer Workflow-Dispatch, Workflow-Run-Lookup und Workflow-Logs entfernen, ohne Auth-/Guard-/Workflow-Vertraege zu verbreitern oder zu veraendern.

## Umsetzung

- `hooks/useGitHubActionsLogs.ts` sendet in den produktiven Aufrufen zu `github-workflow-runs` und `github-workflow-logs` kein `githubToken` mehr im JSON-Body.
- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts` sendet in `github-workflow-dispatch` kein `githubToken` mehr im JSON-Body.
- `supabase/functions/github-workflow-runs/index.ts`, `supabase/functions/github-workflow-logs/index.ts` und `supabase/functions/github-workflow-dispatch/index.ts` lesen den GitHub-Token nur noch serverseitig ueber `getGithubToken()` aus `supabase/functions/_shared/github.ts`.
- `supabase/functions/_shared/validation.ts` traegt fuer `validateGithubWorkflowDispatchRequest(...)` keinen `githubToken` mehr durch, damit der Request-Contract keine unnötige PAT-Passthrough-Schiene offenhaelt.

## Regressionen / Tests

- Vertrags-Tests sichern, dass die produktiven Client-Hooks kein `githubToken` mehr in die JSON-Bodies schreiben.
- Dispatch-Validation/Contract-Tests sichern, dass der Dispatch-Request weiter alias-kompatibel bleibt, aber keinen `githubToken` mehr normalisiert.
- Neuer Patch-515-Invariant prueft, dass die drei Edge-Entry-Points auf der Shared-GitHub-Token-Linie bleiben und die bestehenden `requireAdminKeyOrServiceRoleBearer(req)`-Guards unveraendert erhalten bleiben.

## Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
