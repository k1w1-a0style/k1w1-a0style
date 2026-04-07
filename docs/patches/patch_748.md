# Patch 748 — Mini-Finish: `main` aus verbleibenden Writeback-Pfaden entfernt

## Ziel

Letzter enger Scope aus dem PR-572-Follow-up:
- pruefen, ob `main` in verbleibenden Writeback-Pfaden fachlich zwingend ist
- falls nicht, sicher entfernen und Invariants/Doku nachziehen

## Umsetzung

1. `main` aus Writeback-Regex in folgenden Pfaden entfernt:
   - `.github/workflows/eas-link.yml`
   - `.github/workflows/k1w1-ci-lite-autofix.yml`
   - zugehoerige Managed-/Template-Quellen (`shared/workflows/*`, `templates/expo-sdk54-*.json`, `k1w1-ci-lite.yml`)
2. Writeback erlaubt damit nur noch `work|codex|dev|develop`.
3. Invariant-Test fuer Writeback-Regex nachgezogen.
4. Kern-Doku-/Patchlog-/Checklog auf finalen Mini-Finish-Stand synchronisiert.

## Tests / Checks

- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/easBuildWritebackRefGuard.invariants.test.ts __tests__/patch422.templateWorkflowBaseline.invariants.test.ts __tests__/previewEdgeErrorContract.test.ts`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `npm run -s docs:lint`
- `npm run -s docs:check:contracts`
- `bash scripts/check_patch_docs_sync.sh`

## Nicht-Ziele

- keine neuen Persistenz-/Recovery-Änderungen
- keine Änderung am Preview-Runtime-Verhalten
