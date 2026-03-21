# Patch 525 — CI-Lite-Chain-Run-Matching ohne `__TEST_ONLY__`-Hook-Export

## Ziel

Der job_id-basierte Chain-Run-Fix aus Patch 524 bleibt erhalten, aber der kleine Review-Follow-up
zieht die Testbarkeit produktionsnah gerade: die pure Run-Matching-Logik soll nicht als
`__TEST_ONLY__`-Export direkt am Hook haengen.

## Root Cause

- Patch 524 loeste das fachliche Problem korrekt, fuehrte fuer gezielte Tests aber einen
  `__TEST_ONLY__`-Export in `useCiLiteWorkflow.ts` ein.
- Damit lag Test-spezifische API direkt am produktiven Hook, obwohl die betroffene Matching-Logik
  bereits als pure Helper-Funktion separierbar ist.

## Umsetzung

1. `components/CiLiteHeaderButton/hooks/workflowRunMatching.ts`
   - enthaelt jetzt die pure Matching-Logik fuer CI-Lite-Workflow-Runs:
     `matchesWorkflowRunContract(...)` und `chooseWorkflowRunCandidate(...)`
   - der fachliche Vertrag bleibt unveraendert:
     - `job_id` ist Primäranker
     - `sourceHeadSha` ist nur Guard/Sorter
2. `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
   - importiert den kleinen Helper statt lokale Test-Only-Exports vorzuhalten
   - der Chain-Poll bleibt unveraendert auf `requireJobIdMarker: true`
3. `__tests__/ciLiteChainRunCorrelation.test.ts`
   - testet denselben Determinismus jetzt direkt ueber den Helper statt ueber einen
     produktiven Test-Only-Export

## Tests / Checks

- `bash scripts/check_patch_docs_sync.sh`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Risiko / Scope

- Kein fachlicher Umbau am CI-Lite-Contract aus Patch 524.
- Kein Eingriff in Preview, Backup, Build, Auth oder Repo-Allowlist.
- Reiner kleiner Surface-Cleanup im exakt selben Chain-Run-Matching-Scope.
