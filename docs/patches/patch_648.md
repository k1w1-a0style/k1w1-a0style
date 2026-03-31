# Patch 648 - Refactor Durchlauf 10 (CI-Lite Lookup-Failure-Label helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im CI-Lite-Hotspot umsetzen.
- Lookup-Failure-Label-Auswahl aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveCiLiteLookupFailureLabel(...)` in `useCiLiteWorkflowHelpers.ts`.
- `useCiLiteWorkflow.ts` nutzt den Helper statt lokaler Label-Literale fuer Chain-vs-Default-Lookup-Failure-Kontext.
- Keine Dispatch-/Lookup-/Auth-/Polling-Flow-Aenderung; nur Label-Mapping zentralisiert.
- Tests erweitert (`__tests__/useCiLiteWorkflowHelpers.test.ts`) fuer `chain` und `default`.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
