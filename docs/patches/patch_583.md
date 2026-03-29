# Patch 583 – Zwei kleine Pure-Logic-Extracts in ProjectContext + AIContext

## Ziel
Kleiner Kombi-Schritt mit genau einem gut reviewbaren Pure-Logic-Block pro Context-Datei, ohne Context-Redesign oder Persistenz-Flow-Umbau.

## Aenderung A – `contexts/ProjectContext.tsx`
- Erweiterung von `contexts/projectContextHelpers.ts` um den reinen Delete-/Filter-Block:
  - `removeProjectFilesByPaths(currentFiles, pathsToRemove)`
- `ProjectContext` nutzt den Helper jetzt in:
  - `deleteFile(...)`
  - `deleteFiles(...)`

Damit liegt die Dateiloesch-Filterlogik (inkl. leerer/ungueltiger Pfade) nicht mehr doppelt inline im Context.

## Aenderung B – `contexts/AIContext/index.tsx`
- Erweiterung von `contexts/AIContext/helpers.ts` um den reinen Provider-Selection-Block:
  - `buildProviderSelectionPatch({ providerType, provider, qualityMode })`
- `AIContext` nutzt den Helper jetzt in:
  - `setSelectedChatProvider(...)`
  - `setSelectedAgentProvider(...)`

Damit liegt die wiederholte Provider-/Default-Mode-Ableitung nicht mehr doppelt inline im Context.

## Semantik / bewusst unveraendert
- Keine API-Aenderung nach aussen.
- Kein beabsichtigter Verhaltenswechsel bei:
  - `updateProjectFiles`, `deleteFile`, `createNewProject`
  - `lastModified`, Storage-/Rehydration-Verhalten
  - Provider-/Mode-Auswahl, `qualityMode`, `agentEnabled`, `apiKeys`

## Tests / Absicherung
- Erweitert: `__tests__/projectContext.helpers.test.ts`
  - `removeProjectFilesByPaths(...)` (single delete, invalid/empty delete candidates)
- Erweitert: `__tests__/aiContext.helpers.test.ts`
  - `buildProviderSelectionPatch(...)` fuer Chat-/Agent-Pfad
- Weiter ausgefuehrt:
  - `__tests__/aiContext.persistence.test.tsx`
  - `__tests__/aiContext.qualityMode.test.ts`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/projectContext.helpers.test.ts __tests__/aiContext.helpers.test.ts __tests__/aiContext.persistence.test.tsx __tests__/aiContext.qualityMode.test.ts`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
