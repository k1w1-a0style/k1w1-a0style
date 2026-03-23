# Patch 531 — Pending-Guard-Race in `useGitHubActionsLogs`

## Ziel
Den verbliebenen Race zwischen Selection-Reset, abortetem Alt-Request und neuem laufenden Fetch schliessen, ohne den ehrlichen Reset bei Input-Wechsel oder den Abort-/stale-guard-Vertrag wieder kaputtzumachen.

## Änderungen
- `hooks/useGitHubActionsLogs.ts`
  - aktiven Fetch jetzt mit `AbortController` und requestgebundenen Refs koordiniert
  - `requestVersionRef` wird nur bei echten neuen Requests erhoeht
  - `pendingRequestVersionRef` verhindert, dass ein spaetes `finally` eines alten Requests den Pending-Guard eines neueren laufenden Requests freigibt
  - Selection-Wechsel aborten nur noch wirklich stale aktive Requests und halten den ehrlichen Reset fuer `logs`, `workflowRun`, `error` und `isLoading`
  - stale/abgebrochene Requests committen weder Fehler noch Run-/Log-State mehr
- `__tests__/useGitHubActionsLogs.contract.test.tsx`
  - neuer fokussierter Race-Test fuer: alter Request wird abortet, neuer Request startet, spaetes `finally` des alten Requests oeffnet keinen zweiten Parallel-Request fuer dieselbe neue Selection

## Tests
- `npm run test:silent -- --runInBand __tests__/useGitHubActionsLogs.contract.test.tsx`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
