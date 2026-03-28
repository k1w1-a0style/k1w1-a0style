# Patch 580 – Kleine Entflechtung: Fix-Runner Failure-/Result-Mapping

## Ziel
Naechster kleiner, reviewbarer Entflechtungsschritt in `useDiagnosticFixRunner.ts`: wiederholtes Failure-/Result-Mapping aus dem Hook ziehen, ohne Orchestrierungsumbau.

## Aenderung
- Neuer lokaler pure Helper: `screens/DiagnosticScreen/hooks/fixRunnerResultHelpers.ts`
  - `getErrorMessage(...)`
  - `getFixRuntimeMeta(...)`
  - `buildFailedStepPatch(...)` (inkl. `safeTruncateText(..., 160)`)
  - `buildApplyFailureResult(...)` (inkl. `DiagnosticFixApplyError`-Status + Runtime-Meta/Fallback)
- `useDiagnosticFixRunner.ts` nutzt diese Helper jetzt fuer:
  - wiederholtes Step-Fehler-Mapping (`status: "failed"` + truncation)
  - wiederholte Apply-Fehler -> `finishWithResult(...)` Input-Bildung

## Semantik / bewusst unveraendert
- Hook bleibt Orchestrator (Apply-/Sync-/Rerun-/Modal-Flow unveraendert).
- Keine API-Aenderung nach aussen.
- Keine beabsichtigte Semantik-Aenderung bei:
  - `failed`, `blocked`, `pending_recheck`, `patch_applied`
  - Step-Fehlerdarstellung inkl. Truncation
  - `partial` / `localChangeApplied` in Apply-Fehlerpfaden

## Tests / Absicherung
- Neu: `__tests__/fixRunnerResultHelpers.test.ts`
  - truncation-contract fuer Step-Fehler
  - unknown-error fail-safe (`getErrorMessage`, `getFixRuntimeMeta`)
  - `DiagnosticFixApplyError`-Status-/Runtime-Meta-Mapping
  - Caller-Fallback fuer `localChangeApplied`/`partial`
- Weiter relevant: `__tests__/useDiagnosticFixRunner.fixSemantics.test.tsx`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/fixRunnerResultHelpers.test.ts __tests__/useDiagnosticFixRunner.fixSemantics.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
