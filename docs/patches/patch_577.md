# Patch 577 - GitHubContext: kleiner Recent-Repo-/Linked-Value-Helper-Schritt

## Ziel
Kleiner, reviewbarer Entflechtungsschritt im zentralen Hotspot `contexts/GitHubContext.tsx`, ohne Context-Umbau, ohne API-Aenderung.

## Umsetzung
- Die doppelte pure Recent-Repo-Logik (dedupe + move-to-front + limit) wurde in den neuen lokalen Helper `contexts/githubContextHelpers.ts` extrahiert (`mergeRecentRepo(...)`).
- Die trim-/null-Fallback-Normalisierung fuer `projectData.linkedRepo` und `projectData.linkedBranch` wurde als kleine pure Funktion `normalizeLinkedGitHubValue(...)` aus dem Context herausgezogen.
- `GitHubContext.tsx` bleibt Orchestrator fuer Rehydration, Storage-Persistenz und Mirror-Flow; es nutzt jetzt nur die extrahierten Helper statt doppelter Inline-Logik.

## Verhaltensvertrag
- Kein beabsichtigter Verhaltenswechsel bei `setActiveRepo`, `setActiveBranch`, `addRecentRepo`, `clearRecentRepos` oder beim Linked-Repo/Branch-Mirror.
- Recent-Repos behalten denselben Vertrag (selected repo nach vorne, Duplikat des selektierten Eintrags entfernen, auf 10 begrenzen).

## Tests / Checks
- Neue fokussierte Regression: `__tests__/githubContextHelpers.test.ts`.
- Bestehender Mirror-Vertragstest weiter aktiv: `__tests__/githubContext.mirror.test.tsx`.
- Ausgefuehrte Checks:
  - `npm run typecheck`
  - `npm run lint:ci`
  - `npm run test:silent -- --runInBand __tests__/githubContextHelpers.test.ts __tests__/githubContext.mirror.test.tsx`
  - `git diff --check`
  - `bash scripts/check_patch_docs_sync.sh`
