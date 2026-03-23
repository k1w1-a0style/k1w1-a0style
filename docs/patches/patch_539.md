# Patch 539 — `useGitHubActionsLogs` Follow-up-Regressionen nach Patch 538 geschlossen

## Ausgangslage

Patch 538 hat den Abort-/Timeout-Vertrag in `hooks/useGitHubActionsLogs.ts` sinnvoll gehaertet. Auf dem aktuellen `codex`-Stand blieben aber zwei echte Hook-Regressionen uebrig:

1. `fetchLogs()` erhoehte `requestVersionRef` schon vor dem `isFetchPendingRef.current`-Guard. Ein zweiter `refreshLogs()`-Aufruf oder Poll waehrend eines laufenden Requests machte damit den aktiven Request still stale, obwohl gar kein neuer Request startete.
2. Der Selection-Reset fuer `[githubRepo, runId, workflowId]` lief nach dem Auto-Refresh-Effekt. Bei `autoRefresh=true` startete der neue Selection-Fetch bereits und wurde direkt danach vom eigenen Reset wieder abortet.

Der Scope blieb bewusst klein: kein Umbau des Hooks, kein Rueckbau des Abort-/Timeout-Vertrags und keine Aenderungen ausserhalb des direkt betroffenen Hook-/Test-/Patch-Doku-Scope.

## Umsetzung

- `hooks/useGitHubActionsLogs.ts`
  - verschiebt die `requestVersionRef`-Erhoehung hinter den `githubRepo`- und Pending-Guard.
  - vergibt `requestKeyRef.current` und die neue Request-Version nur noch dann, wenn wirklich ein neuer Fetch startet.
  - zieht den bestehenden Selection-Reset-Effekt vor den Auto-Refresh-Effekt, damit Input-Wechsel weiter ehrlich resetten, aber der erste legitime Fetch fuer die neue Auswahl nicht vom Reset-Effekt selbst invalidiert wird.

- `__tests__/useGitHubActionsLogs.contract.test.tsx`
  - erweitert den Contract-Test um einen Pending-Refresh-Fall, in dem ein zweiter `refreshLogs()`-Aufruf den laufenden Request weder invalidiert noch `isLoading` haengen laesst.
  - erweitert den Contract-Test um einen Selection-/`runId`-Wechsel mit `autoRefresh=true`, der sicherstellt, dass der erste neue Fetch nicht sofort per Abort weggeschossen wird.

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useGitHubActionsLogs.contract.test.tsx`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
