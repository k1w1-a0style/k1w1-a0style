# Patch 643 - Refactor Durchlauf 5 (CI-Lite Lookup-Failure Resolver helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im CI-Lite-Hotspot umsetzen.
- Lookup-Failure-Message-Mapping aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveCiLiteLookupFailureMessage(...)` in `useCiLiteWorkflowHelpers.ts`.
- `useCiLiteWorkflow.ts` nutzt den Helper statt lokaler Inline-Branching-Logik fuer `ambiguous` / `contract_mismatch` / `timeout`.
- Keine Dispatch-/Lookup-/Auth-Flow-Aenderung; nur Message-Resolver extrahiert.
- Tests erweitert (`__tests__/useCiLiteWorkflowHelpers.test.ts`) fuer Ambiguous-, Contract-Mismatch- und Timeout-Fallback-Fall.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
