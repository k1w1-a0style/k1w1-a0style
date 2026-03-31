# Patch 645 - Refactor Durchlauf 7 (CI-Lite Pending-Run Message helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im CI-Lite-Hotspot umsetzen.
- Pending-Run-Statuszeilen-Mapping aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveCiLitePendingRunMessage(...)` in `useCiLiteWorkflowHelpers.ts`.
- `useCiLiteWorkflow.ts` nutzt den Helper statt lokaler Inline-Textauswahl fuer Chain-Waiting-/job_id-/Fallback-Message.
- Keine Dispatch-/Lookup-/Auth-/Status-Flow-Aenderung; nur Message-Mapping zentralisiert.
- Tests erweitert (`__tests__/useCiLiteWorkflowHelpers.test.ts`) fuer Chain-Waiting, job_id und Fallback.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
