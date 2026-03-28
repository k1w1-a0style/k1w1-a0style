# Patch 576 - GitHubReposScreen Hook: kleiner Error-Helper-Entflechtungsschritt

## Ziel
Kleiner, risikoarmer Entflechtungsschritt im userkritischen Hook-Hotspot `screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts`, ohne Hook-Umbau und ohne API-Aenderung.

## Umsetzung
- Die pure Error-Message-Logik (`unknown`/`Error`/String/Object-mit-message + Fallback) wurde aus dem Hook in den neuen lokalen Helper `screens/GitHubReposScreen/hooks/githubReposScreenErrorHelpers.ts` extrahiert.
- `useGitHubReposScreen.ts` importiert jetzt `getErrorMessage(...)` aus dem Helper statt den Inline-Block lokal zu definieren.
- Der Hook bleibt Orchestrator fuer Repo-Aktionen, Busy-/Dialog-/Async-Flow; nur pure Berechnungslogik wurde ausgelagert.

## Verhaltensvertrag
- Kein beabsichtigter Verhaltenswechsel bei Create/Rename/Delete/Pull/Push/EAS-Link/Secrets-Alerts.
- Catch-Fallback-Semantik bleibt gleich (`getErrorMessage(error, "")` fuer action-nahe Alerts, explizite Fallbacks wie beim Token-Laden unveraendert).

## Tests / Checks
- Neue fokussierte Regression: `__tests__/githubReposScreen.errorHelpers.test.ts`.
- Ausgefuehrte Checks:
  - `npm run typecheck`
  - `npm run lint:ci`
  - `npm run test:silent -- --runInBand __tests__/githubReposScreen.errorHelpers.test.ts __tests__/githubReposScreen.easLinkStatusRace.test.tsx __tests__/githubReposScreen.pullPushSemantics.test.ts`
  - `git diff --check`
  - `bash scripts/check_patch_docs_sync.sh`
