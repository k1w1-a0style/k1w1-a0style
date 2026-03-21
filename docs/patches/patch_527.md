# Patch 527 — CI-Lite-Persistenz auf Repo/Branch-Scoped Snapshot-Vertrag umgestellt

## Ziel

CI-Lite sollte nicht laenger primär ueber flache globale `CI_LITE_*`-Keys Wahrheit transportieren.
Dieser Patch haertet die Persistenz auf einen sauberen repo-/branch-scoped Snapshot-Vertrag,
behaelt Legacy-Keys nur noch als Migration/Fallback und zieht Header- sowie Build-Readiness-Lesepfade
auf dieselbe bevorzugte Quelle.

## Umsetzung

1. `lib/storageKeys.ts`
   - neuer Helper `ciLiteSnapshotKeyForSelection(...)`
   - neuer Basis-Key `CI_LITE_SCOPED_SNAPSHOT`
   - Kommentar im Code: scoped Snapshot ist die bevorzugte CI-Lite-Source-of-Truth; flache Keys bleiben Legacy
2. `lib/ciLitePersistence.ts`
   - liest zuerst den repo-/branch-scoped Snapshot `ci_lite_snapshot::<repo>::<branch>`
   - validiert Snapshot-Felder streng (`repo`, `branch`, `sha`, `runAtMs`, `lintOk`, `typecheckOk`, Workflow, Conclusion)
   - nutzt globale `CI_LITE_LAST_*`-/Bool-Keys nur noch als Fallback, wenn gar kein scoped Snapshot vorhanden ist
   - neue Helper-Funktion `buildPersistCiLiteEntries(...)` schreibt den bevorzugten Snapshot und optional denselben Legacy-Mirror fuer sanfte Migration
3. `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
   - completed CI-Lite-Runs persistieren jetzt ueber `buildPersistCiLiteEntries(...)`
   - Kommentar im Hook markiert scoped Snapshot als bevorzugte Wahrheit; Legacy-Mirror ist temporär
4. `project/services/buildStartService.ts`
   - Build-Readiness liest CI-Lite nicht mehr direkt ueber verstreute globale Keys,
     sondern ueber `readPersistedCiLiteSelection(...)` mit demselben scoped/Fallback-Vertrag wie der Header
5. Tests
   - fokussierte Jest-Regressionen fuer scoped Read, Repo-/Branch-Mismatch, Legacy-Fallback,
     kaputte Persistenz und scoped Write-Pfad ergänzt/aktualisiert

## Vertrag

Bevorzugter Key:
- `ci_lite_snapshot::<encodeURIComponent(repo.toLowerCase())>::<encodeURIComponent(branch)>`

Snapshot-Shape:
- `repo`
- `branch`
- `sha`
- `runAtMs`
- `workflowId`
- `jobId`
- `runId`
- `conclusion`
- `lintOk`
- `typecheckOk`

Legacy-Fallback bleibt voruebergehend erhalten:
- `CI_LITE_LINT_OK`
- `CI_LITE_TYPECHECK_OK`
- `CI_LITE_LAST_RUN_AT`
- `CI_LITE_LAST_REPO`
- `CI_LITE_LAST_BRANCH`
- `CI_LITE_LAST_SHA`
- `CI_LITE_LAST_WORKFLOW`
- `CI_LITE_LAST_JOB_ID`
- `CI_LITE_LAST_RUN_ID`
- `CI_LITE_LAST_CONCLUSION`

## Tests / Checks

- `npm test -- --runInBand __tests__/ciLitePersistence.test.ts`
- `npm test -- --runInBand __tests__/useCiLiteWorkflow.behavior.test.tsx`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`

## Risiko / Scope

- Kein breiter Projektumbau; nur CI-Lite-Persistenz, eng angrenzender Header-Write-Pfad,
  gemeinsamer Read-Helper und direkter Build-Readiness-Consumer wurden angefasst.
- Single-Repo-/Single-Branch-Nutzer behalten funktionierende Legacy-Kompatibilitaet,
  bekommen aber nun dieselbe Wahrheit schon sauber scoped.
