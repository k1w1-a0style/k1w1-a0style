# Patch 639 - Refactor Durchlauf 1 (helper-first, sicher)

## Ziel
- Auf dem frisch konsolidierten Deep-Scan-Stand einen sicheren Refactor-Durchlauf umsetzen.
- Keine Produkt-/Vertragslogik veraendern.

## Umgesetzt
1. CI-Lite-Hotspot:
   - `parseCiLiteArtifactJson(...)` aus `useCiLiteWorkflow.ts` in `useCiLiteWorkflowHelpers.ts` extrahiert.
   - Hook-Orchestrierung unveraendert, nur pure Parsing-Logik zentralisiert.

2. Diagnostic-Fix-Hotspot:
   - Preview-Entry-Bildung aus `useDiagnosticFixRunner.ts` in `buildFixPreviewEntries(...)` in `useDiagnosticFixRunnerHelpers.ts` ausgelagert.
   - Reihenfolge/Content der Preview-Eintraege bleibt unveraendert.

3. Tests:
   - `__tests__/useCiLiteWorkflowHelpers.test.ts` um Parser-Faelle erweitert.
   - `__tests__/useDiagnosticFixRunnerHelpers.test.ts` um Preview-Entry-Builder-Fall erweitert.

## Verifikation
```bash
npm run test:silent -- --runInBand __tests__/useCiLiteWorkflowHelpers.test.ts __tests__/useDiagnosticFixRunnerHelpers.test.ts
npm run typecheck
npm run lint:ci
npm run test:silent
git diff --check
bash scripts/check_patch_docs_sync.sh
```
