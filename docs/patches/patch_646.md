# Patch 646 - Refactor Durchlauf 8 (CI-Lite Hydrated StepInfo helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im CI-Lite-Hotspot umsetzen.
- Hydrated-Snapshot-zu-StepInfo-Mapping aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveHydratedCiLiteStepInfo(...)` in `useCiLiteWorkflowHelpers.ts`.
- `useCiLiteWorkflow.ts` nutzt den Helper statt lokaler inline Abbildung fuer `lint`/`typecheck`/Fehlerzaehler.
- Keine Dispatch-/Lookup-/Auth-/Polling-Flow-Aenderung; nur StepInfo-Mapping zentralisiert.
- Tests erweitert (`__tests__/useCiLiteWorkflowHelpers.test.ts`) fuer `lintOk`/`typecheckOk`-Kombinationen.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
