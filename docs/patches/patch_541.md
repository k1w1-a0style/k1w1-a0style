# Patch 541

## Titel
Netzwerk-Hardening fuer verbleibende Fetch-/Timeout-/Abort-Luecken in App- und Edge-Pfaden.

## Was wurde geaendert?
- gemeinsame AbortController-basierte Timeout-Helper fuer App (`lib/network/fetchWithTimeout.ts`) und Edge (`supabase/functions/_shared/fetchWithTimeout.ts`) eingefuehrt;
- nackte `fetch(...)`-Aufrufe in den verbleibenden Zielpfaden (`infra/github/*`, `useCiLiteWorkflow`, `useConnectionsScreen`, `lib/retryWithBackoff`) auf den gemeinsamen Timeout-/Abort-Vertrag umgestellt;
- Retry-Logik abort-aware gemacht, sodass echte Aborts/Timeouts nicht still weiter-retried werden;
- GitHub-/CodeSandbox-/Provider-Upstream-Requests in den betroffenen Edge Functions auf echte AbortController-Timeouts gehaertet;
- `github-run-artifact-json` und der deploybare `test`-Edge-Endpoint an den vorhandenen Rate-Limiter angeschlossen;
- fokussierte Tests fuer Timeout-Helfer, abort-aware Retry, CI-Lite-Timeout-Kommunikation und direkten ConnectionsScreen-Renderpfad ergaenzt/aktualisiert.

## Validierung
- `npm run test:silent -- --runInBand lib/__tests__/fetchWithTimeout.test.ts lib/__tests__/retryWithBackoff.test.ts __tests__/useCiLiteWorkflow.behavior.test.tsx __tests__/connectionsScreen.screen.test.tsx`
- `npx eslint components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts screens/ConnectionsScreen/hooks/useConnectionsScreen.ts infra/github/branchOps.ts infra/github/compare.ts infra/github/files.ts infra/github/repos.ts infra/github/secrets.ts infra/github/user.ts infra/github/utils.ts infra/github/workflows.ts lib/network/fetchWithTimeout.ts lib/retryWithBackoff.ts --no-warn-ignored`
- `timeout 90s npm run typecheck` *(lauf in dieser Umgebung nach 90s abgebrochen; kein Ergebnis innerhalb des Zeitfensters)*
