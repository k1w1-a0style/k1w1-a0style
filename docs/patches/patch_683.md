# Patch 683 — Storage/Context/Auth-ish test debt wave

## Scope
- `__tests__/diagnosticPreferencesHydration.test.tsx`
- `__tests__/projectPersistence.sizeGuard.test.ts`
- `__tests__/projectContext.createNewProject.regression.test.tsx`
- `__tests__/chatChangeSummary.test.ts`

## Changes
- AsyncStorage mock helpers reused instead of local `as any` internals.
- Project fixtures now use typed `makeProjectData(...)` / `makeProjectFile(...)`.
- `Alert.alert` mock in project context regression test now uses `Parameters<typeof Alert.alert>` + `AlertButton`.
- Chat change summary tests now use `OrchestratorResult` instead of loose `as any` responses.

## Validation
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`
