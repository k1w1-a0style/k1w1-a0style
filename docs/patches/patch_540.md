# Patch 540 — Pending-Guard-Race in `useGitHubActionsLogs` beim Selection-Wechsel geschlossen

## Ausgangslage

Patch 539 hat zwei echte Follow-up-Regressionen in `hooks/useGitHubActionsLogs.ts` bereits behoben, aber im Review zu PR 402 blieb noch ein legitimer Restpunkt:

- der Selection-Reset fuer `[githubRepo, runId, workflowId]` abortete einen alten laufenden Request korrekt,
- setzte den Pending-Guard aber sofort global frei,
- und das spaetere `finally` des alten aborteten Requests konnte dadurch einen bereits laufenden neuen Request fuer die neue Selection ungewollt wieder „freigeben“.

Die Folge war moeglich:

1. neue Selection startet den ersten legitimen Fetch,
2. altes abortetes `finally` setzt den globalen Pending-State spaeter zurueck,
3. Poll oder manueller Refresh startet dadurch einen zweiten parallelen Fetch fuer dieselbe neue Selection,
4. dessen neuere `requestVersionRef` macht den ersten legitimen Erfolg danach stale.

## Umsetzung

- `hooks/useGitHubActionsLogs.ts`
  - ersetzt den globalen Boolean-Pending-Guard durch eine request-gebundene Pending-Wahrheit (`pendingRequestVersionRef`).
  - markiert den Pending-State nur fuer die konkret gestartete Request-Version.
  - gibt den Pending-State im `finally` nur dann frei, wenn dieses `finally` noch denselben aktiven Request besitzt.
  - behaelt den Selection-Reset, Abort-/Timeout-Vertrag und die bestehende stale-commit-Abwehr ueber `requestKeyRef` + `requestVersionRef` unveraendert im Kern bei.

- `__tests__/useGitHubActionsLogs.contract.test.tsx`
  - ergaenzt einen gezielten Race-Test:
    - alter Request wird durch Selection-Wechsel abortet,
    - neuer Request startet direkt danach,
    - das spaete `finally` des alten Requests darf den Pending-Guard des neuen Requests nicht freigeben,
    - ein weiterer `refreshLogs()` waehrend des neuen laufenden Requests startet deshalb keinen dritten Parallel-Request.

## Erhaltener Vertrag

- `requestVersionRef` wird weiterhin nur bei echten neuen Requests erhoeht.
- der erste legitime Auto-Refresh-Fetch nach Selection-Wechsel bleibt aktiv.
- stale Responses duerfen weiterhin nicht committen.
- Abort-/Timeout-Vertrag bleibt unveraendert erhalten.
- der ehrliche Reset von `logs`, `workflowRun`, `error` und `isLoading` bei Input-Wechsel bleibt bestehen.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useGitHubActionsLogs.contract.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
