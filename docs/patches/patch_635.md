# Patch 635 — letzter Helper-Follow-up + Deep-Scan-/Docs-Sync

## Ziel

Noch einen letzten kleinen, sicheren Follow-up aus dem Helper-Refactor-Block umsetzen und parallel den Deep-Scan-/Review-Stand sauber aktualisieren.

## Änderungen

1. **GitHubRepos Sync-Status Guard nachgezogen**
   - `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`
   - `refreshSyncStatus(...)` setzt bei `resolveSyncStatusPrecheck(...).status === "invalid_repo"` jetzt explizit:
     - `error: 1`
     - `checkedAt: Date.now()`
   - Vorher wurde in diesem Fall still zurückgegeben; dadurch konnte die Anzeige auf alten Sync-Werten stehen bleiben.

2. **Regressionstest erweitert**
   - `__tests__/useGitHubReposScreenHelpers.test.ts`
   - Neuer Assert für den deterministischen `invalid_repo`-Precheck-Zweig.

3. **Deep-Scan-/Review-Doku aktualisiert**
   - `docs/reviews/deep-scan-review-2026-03-30.md` um Addendum erweitert:
     - Ampelsystem P0/P1/P2
     - konkrete Refactoring-/Cleanup-Kandidaten mit Stellen
     - ASNI-Einträge (Action/Scope/Need/Impact)
     - kritische Einordnung zu Dead-Code-/False-Positive-Scans

4. **Patch-Doku-Sync**
   - `docs/patches/PATCHLOG_ROOT.md`
   - `PROJECT_CHECKLOG.md`
   - `README.md`
   - `docs/TODO.md`

## Verifikation

- `npm run test:silent -- --runInBand __tests__/useGitHubReposScreenHelpers.test.ts __tests__/useConnectionsScreenHelpers.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `node scripts/docsLint.js`
- `bash scripts/check_patch_docs_sync.sh`
