# Patch 579 – Kleine Entflechtung: CI-Lite-Artifact-Kontext + GitHubContext-Rehydration

## Ziel
Zwei bewusst kleine pure-logic-Extracts in den Hotspots `useCiLiteWorkflow.ts` und `GitHubContext.tsx`, ohne Orchestrierungsumbau und ohne API-Vertragsaenderung.

## A) `useCiLiteWorkflow.ts`
- Extrahiert wurde der kleine pure Block fuer Artifact-Fetch-Eligibility + stabilen Kontext-Key in:
  - `components/CiLiteHeaderButton/hooks/useCiLiteWorkflowHelpers.ts`
  - Helper: `buildArtifactFetchContextKey(...)`
- Der Hook bleibt Orchestrator fuer Async-/Polling-/Artifact-Flow; Stop/Unmount/Loop-Guard-Verhalten bleibt unveraendert.

## B) `GitHubContext.tsx`
- Extrahiert wurde die gespeicherte Recent-Repos-Rehydration-Normalisierung in:
  - `contexts/githubContextHelpers.ts`
  - Helper: `normalizeStoredRecentRepos(...)`
- Semantik bleibt gleichgerichtet: string-only, trim, empty raus, dedupe, limit.
- Persistenz-/Mirror-Flow und oeffentliche Context-API bleiben unveraendert.

## Tests / Absicherung
- Neu: `__tests__/useCiLiteWorkflowHelpers.test.ts`
- Erweitert: `__tests__/githubContextHelpers.test.ts`
- Weiter relevant/gruen: `__tests__/useCiLiteWorkflow.behavior.test.tsx`, `__tests__/githubContext.mirror.test.tsx`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/useCiLiteWorkflowHelpers.test.ts __tests__/githubContextHelpers.test.ts __tests__/useCiLiteWorkflow.behavior.test.tsx __tests__/githubContext.mirror.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`

## Hinweis
Kein Hook-/Context-Redesign, keine neue State-Maschine, kein beabsichtigter Verhaltenswechsel.
