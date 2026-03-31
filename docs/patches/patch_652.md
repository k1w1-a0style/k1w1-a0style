# Patch 652 - Refactor Durchlauf 14 (CI-Lite Busy-State helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im CI-Lite-Hotspot umsetzen.
- Busy-State-Aggregation aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveCiLiteBusyState(...)` in `useCiLiteWorkflowHelpers.ts`.
- `useCiLiteWorkflow.ts` nutzt den Helper statt lokaler inline Busy-Aggregation ueber Dispatch/Lookup/Chain/Logs/Workflow-Status.
- Keine Dispatch-/Lookup-/Auth-/Polling-Flow-Aenderung; nur Busy-Mapping zentralisiert.
- Tests erweitert (`__tests__/useCiLiteWorkflowHelpers.test.ts`) fuer queued/running/idle-Faelle.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
