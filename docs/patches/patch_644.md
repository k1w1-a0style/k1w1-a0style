# Patch 644 - Refactor Durchlauf 6 (CI-Lite Artifact Request helper-first)

## Ziel
- Naechsten kleinen, sicheren Refactor-Schritt im CI-Lite-Hotspot umsetzen.
- Artifact-Name/-Pfad-Mapping aus dem Hook in einen reinen Helper verlagern.

## Umgesetzt
- Neuer Helper `resolveCiLiteArtifactRequest(...)` in `useCiLiteWorkflowHelpers.ts`.
- `useCiLiteWorkflow.ts` nutzt den Helper statt lokaler Autofix-vs-CI-Lite-Ternary-Logik.
- Keine Dispatch-/Lookup-/Auth-/Artifact-Flow-Aenderung; nur Request-Mapping zentralisiert.
- Tests erweitert (`__tests__/useCiLiteWorkflowHelpers.test.ts`) fuer beide Workflow-Pfade.

## Verifikation
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
bash scripts/check_patch_docs_sync.sh
```
