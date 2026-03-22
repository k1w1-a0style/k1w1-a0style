# Patch 538 — kleiner Maintenance-Block fuer Mirror-/Abort-/Persistenz-Robustheit

## Ausgangslage

Auf dem aktuellen `codex`-Stand blieben drei kleine, reale Restpunkte offen:

1. `contexts/GitHubContext.tsx` spiegelte `projectData.linkedRepo` / `linkedBranch` ueber einen Effekt, der zugleich an `activeRepo` / `activeBranch` hing und diese Werte wieder setzte.
2. `hooks/useGitHubActionsLogs.ts` liess Workflow-Run- und Log-Fetches ohne echten Abort-/Timeout-Vertrag laufen.
3. `contexts/AIContext/index.tsx` schrieb die redacted Config bei jeder relevanten Aenderung sofort nach `AsyncStorage`.

Der Scope blieb bewusst klein: kein Architekturumbau, kein neuer State-Reset-Umbau fuer den Logs-Hook und keine Eingriffe in Preview/CI-Lite/Build/Chat ausserhalb der direkt betroffenen Pfade.

## Umsetzung

- `contexts/GitHubContext.tsx`
  - stabilisiert `setActiveRepo(...)` und `setActiveBranch(...)` ueber Ref-basierte Current-Value-Guards.
  - entkoppelt den Mirror-Effekt von `activeRepo` / `activeBranch`, sodass stabile `projectData.linked*`-Werte keine redundanten zweiten Mirror-Durchlaeufe mehr ausloesen.
  - behaelt `projectData.linkedRepo` / `projectData.linkedBranch` als Source of Truth unveraendert bei.

- `hooks/useGitHubActionsLogs.ts`
  - fuehrt einen kleinen echten Abort-/Timeout-Pfad mit `AbortController` ein.
  - legt einen festen Request-Timeout fuer Workflow-Runs und Workflow-Logs an.
  - invalidiert haengende Requests bei Input-Wechsel/Unmount zusaetzlich ueber Request-Version + Abort-Cleanup, ohne die bestehende Polling-/Soft-not-ready-/Request-Key-Logik zurueckzubauen.

- `contexts/AIContext/index.tsx`
  - coalesced die redacted `AsyncStorage`-Persistenz per kleinem Debounce.
  - belaesst den SecureStore-/API-Key-Vertrag unveraendert: Keys bleiben im SecureStore bzw. nur im Runtime-State, nicht im redacted AsyncStorage-Payload.

- Tests
  - `__tests__/githubContext.mirror.test.tsx`
  - `__tests__/useGitHubActionsLogs.contract.test.tsx`
  - `__tests__/aiContext.persistence.test.tsx`

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/githubContext.mirror.test.tsx __tests__/useGitHubActionsLogs.contract.test.tsx __tests__/aiContext.persistence.test.tsx`
- `bash scripts/check_patch_docs_sync.sh`
