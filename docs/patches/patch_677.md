# Patch 677 — Refactor-Durchlauf 37 + Deep-Scan-Nachzug

## Ziel
Einen weiteren fokussierten Test-/Contract-Debt-Block helper-first reduzieren und den aktuellen Doku-/SoT-Stand per Deep Scan nachziehen.

## Umsetzung
- Neue Test-Helper in `__tests__/helpers/preflightTestHelpers.ts`:
  - `makePreflightPatch(...)`
  - `makePreflightResult(...)`
  - `makeProjectRef(...)`
- `patchEngine.applyOrder`, `patchEngine.deleteRemovesFile`, `patchEngine.idempotency`, `patchEngine.upsertOverwrites` und `patchEngine.jsonMergePreservesSiblings2` nutzen jetzt getypte `ProjectFile[]`-/`PreflightPatch`-Fixtures statt lokaler `as any`-Datei-/Patch-Casts.
- `__tests__/useDiagnosticFixRunner.fixSemantics.test.tsx` und `__tests__/diagnosticSmartFix.fixableOnly.test.tsx` nutzen helper-first getypte Projekt-/Patch-/Result-Factories statt `projectRef as any`-/`mountedRef as any`-/`fix.patch as any`-Pfaden.
- Deep-Scan-Nachzug synchronisiert die Header-Staende von `docs/INDEX.md`, `docs/TESTING_GUIDE.md` und `docs/FRESH_CHECKOUT_GREEN_PATH.md` auf denselben Patchstand.

## Wirkung
- weiterer helper-first Abbau von Test-/Contract-/Fixture-Debt
- keine Produkt-/Runtime-/Contract-Aenderung
- keine stillen Header-Drifts in den Kern-MDs
- ausserhalb von Tests/Docs/Historie bleiben keine `any`-Reste mehr uebrig

## Validierung
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`
