# Patch 650 - Refactor Durchlauf 12 (CI-Lite Completion-Error-Text helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im CI-Lite-Hotspot umsetzen.
- Completion-Error-Textauswahl aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveCiLiteCompletionErrorText(...)` in `useCiLiteWorkflowHelpers.ts`.
- `useCiLiteWorkflow.ts` nutzt den Helper statt lokaler inline Verzweigung fuer Workflow-Failure-vs-Hydrated-Fallback-Text.
- Keine Dispatch-/Lookup-/Auth-/Polling-Flow-Aenderung; nur Error-Text-Mapping zentralisiert.
- Tests erweitert (`__tests__/useCiLiteWorkflowHelpers.test.ts`) fuer Workflow-Fail, Hydrated-Fallback und Success-Leerfall.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
