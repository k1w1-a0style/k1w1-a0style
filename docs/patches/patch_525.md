# Patch 525 — Repo-Secrets-Refresh-/Load-Loop in `SecretsSection` entfernt

## Ziel

Der echte Loop in `screens/GitHubReposScreen/components/SecretsSection.tsx` wird ohne Scope-Ausweitung
entfernt: der automatische Initial-Load soll pro Repo-Kontext genau einmal laufen, manuelle Refreshes
muessen weiter funktionieren, und die bisherige ehrliche Fehler-/Last-known-list-Semantik darf nicht
regressieren.

## Root Cause

- `load` war per `useCallback(...)` memoisiert und hing an `names`.
- `useEffect(() => { load(); }, [load])` startete dadurch nach jedem erfolgreichen `setNames(list)`
  erneut, weil sich die `load`-Referenz mit der geaenderten `names`-Referenz wieder aenderte.
- Das fuehrte zu einem echten Repo-Secrets-Request-/Spinner-Loop, obwohl kein Repo-Wechsel und kein
  manueller Refresh stattgefunden hatte.

## Umsetzung

1. `screens/GitHubReposScreen/components/SecretsSection.tsx`
   - neuer `hasVerifiedNamesRef` kapselt den einzig benoetigten Snapshot „es gab bereits eine
     verifizierte Namensliste“
   - `load` haengt nur noch an `parsed`, nicht mehr an `names`
   - erfolgreicher Load markiert `hasVerifiedNamesRef.current = true`
   - Repo-Wechsel resetten den Ref weiterhin zusammen mit `names/error/stale/loading`, sodass alte
     Requests und alte Verifikationswahrheit sauber invalidiert bleiben
2. `__tests__/githubReposScreen.secretsSectionSemantics.test.tsx`
   - neuer Regressionstest: automatischer Load passiert genau einmal pro Repo-Kontext
   - neuer Regressionstest: manueller Refresh bleibt moeglich, ohne einen automatischen Reload-Loop
     wieder einzufuehren
   - neuer Regressionstest: spaete Antworten aus altem Repo-Kontext duerfen den neuen Kontext nicht
     ueberschreiben
   - neuer Regressionstest: nach erfolgreich verifizierter Liste bleibt die zuletzt bestaetigte
     Namensliste bei Refresh-Fehler sichtbar

## Tests / Checks

- `npm run test:silent -- --runInBand __tests__/githubReposScreen.secretsSectionSemantics.test.tsx`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Risiko / Scope

- Kein Umbau an Admin-Key-, Preview-, Build- oder Repo-Secret-Architektur.
- Kein Refactor des Runtime-Presence-Pfads, weil dort kein entsprechender Hook-Loop nachweisbar war.
- Fix bleibt auf den minimalen Zyklusbruch zwischen `names`, `load` und `useEffect` beschraenkt.
