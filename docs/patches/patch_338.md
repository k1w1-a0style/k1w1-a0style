# Patch 338 — Diagnostics/Testabdeckung Phase 2 (2026-03-01)

## Ziel
Erweiterung der High/Med Testabdeckung für:
- Pipeline Diagnostics (projectId/workflows/eas.json/buildType/withoutCredentials)
- Local Preflight Checks (forbidden files, lockfile consistency, entry-point, eas-withoutcredentials)
- Patch Apply Engine (delete/upsert/jsonMerge Reihenfolge + Korrektheit)

## Änderungen
- Neue Pipeline-Diagnostics Tests (T6–T10) ergänzt.
- Neue Preflight Tests (T11–T14) ergänzt.
- Patch Engine als kleine pure Helper-Funktion (`applyPreflightPatch`) eingeführt und mit 4 Tests abgedeckt (T15–T18).
- `runBuildPipelineDiagnostics` robust gemacht: `repo.easJson.parse` wird jetzt korrekt auf `fail` gesetzt, wenn `eas.json` nicht parsebar ist.

## Neue Testdateien
- `__tests__/pipelineDiagnostics.easProjectIdDetectionOrder.test.ts`
- `__tests__/pipelineDiagnostics.workflowsPresence.test.ts`
- `__tests__/pipelineDiagnostics.easJsonParseFail.test.ts`
- `__tests__/pipelineDiagnostics.easBuildTypeAutofixPatch.test.ts`
- `__tests__/pipelineDiagnostics.withoutCredentialsRules.test.ts`
- `__tests__/preflight.securityForbiddenFiles.test.ts`
- `__tests__/preflight.lockfileConsistency.test.ts`
- `__tests__/preflight.entryPointAutofix.test.ts`
- `__tests__/preflight.easWithoutCredentialsDebugPatch.test.ts`
- `__tests__/patchEngine.applyOrder.test.ts`
- `__tests__/patchEngine.jsonMergePreservesSiblings2.test.ts`
- `__tests__/patchEngine.deleteRemovesFile.test.ts`
- `__tests__/patchEngine.upsertOverwrites.test.ts`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand`
- Zusätzlich gezielter Jest-Lauf für die neuen 13 Testdateien.
