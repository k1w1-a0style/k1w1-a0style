# Patch 634 — PR-504 Review-Follow-up (Materializer fail-safe Hydration)

## Ziel
Echten Regressionspfad in `lib/projectMaterializer.ts` beheben: `materializeProjectFiles(...)` durfte bei malformed `project.files`-Eintraegen (`null`, primitive Werte, unvollstaendige Objekte) nicht bei `file.content` crashen, sondern musste diese Eintraege wie frueher fail-safe ignorieren.

## Umgesetzt
1. **Guard vor Content-Read (minimaler Scope)**
   - `lib/projectMaterializer.ts`
   - Neuer enger Objekt-Guard (`isProjectFileLike(...)`) fuer eingehende Dateieintraege.
   - `readProjectFileContent(...)` wird erst aufgerufen, nachdem ein Eintrag als Objektkandidat validiert wurde.
   - Dadurch bleiben `null`/primitive/malformed Eintraege skipbar, ohne Runtime-Crash.

2. **Gezielter Regressionstest**
   - `__tests__/projectMaterializer.failSafe.regression.test.ts`
   - Deckt explizit `project.files` mit invaliden Eintraegen ab.
   - Erwartung: kein Throw im Materializer-Pfad; invalide Eintraege werden uebersprungen; valide Dateien werden weiterhin materialisiert.

## Doku-Sync
- `README.md`
- `PROJECT_CHECKLOG.md`
- `docs/TODO.md`
- `docs/INDEX.md`
- `docs/04-risk-hotspots.md`
- `docs/FRESH_CHECKOUT_GREEN_PATH.md`
- `docs/TESTING_GUIDE.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_627.md` (Follow-up-Hinweis)

## Verifikation
- `npm run test:silent -- --runInBand __tests__/projectMaterializer.failSafe.regression.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/projectFiles.normalize.regression.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_workflow_template_drift.sh`
- `bash scripts/check_managed_workflows.sh`
- `bash scripts/check_workflow_edge_contracts.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
- `git diff --check`
