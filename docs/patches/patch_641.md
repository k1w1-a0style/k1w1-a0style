# Patch 641 - Refactor Durchlauf 3 (CI-Lite helper-first)

## Ziel
- Nächsten sicheren, kleinen Refactor-Schritt im CI-Lite-Hotspot umsetzen.
- Keine Vertrags-/Flow-Aenderung, nur pure-logic-Entkopplung.

## Umgesetzt
- Neuer Helper `mergeWorkflowRunLookupDiagnosis(...)` in `useCiLiteWorkflowHelpers.ts`.
- `useCiLiteWorkflow.ts` verwendet diesen Helper statt lokaler Inline-Merge-Logik fuer Lookup-Diagnosen.
- Fokussierte Helper-Tests um Merge-Faelle erweitert (null, expliziter Treffer, neutraler Merge mit Signal-Weitergabe).

## Verifikation
```bash
npm run test:silent -- --runInBand __tests__/useCiLiteWorkflowHelpers.test.ts __tests__/ciLiteArtifactParsing.test.ts
npm run typecheck
npm run lint:ci
npm run test:silent
git diff --check
bash scripts/check_patch_docs_sync.sh
```
