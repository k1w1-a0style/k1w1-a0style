# Patch 675 — Refactor-Durchlauf 35 (test/fixture typing cleanup wave 2)

## Ziel
Den naechsten fokussierten Test-/Fixture-Debt-Block in Build-/Readiness-/Diagnostics-Tests helper-first nachziehen, ohne Produktvertraege oder Build-/Dispatch-Logik anzufassen.

## Umsetzung
- neue Test-Helper in `__tests__/helpers/projectTestHelpers.ts`:
  - `makeProjectData(...)`
  - `makeProjectFile(...)`
  - `createMountedRef(...)`
- `buildReadinessContract.test.ts` nutzt jetzt `makeProjectData(...)` statt lokaler `ProjectData as any`-/`ProjectFile as any`-Fixtures
- `buildReadinessGate.diagnosticScopedSelection.test.ts`, `buildReadinessGate.diagnosticLastOk.test.ts`, `buildReadinessGate.ciLiteFreshness.test.ts` und `buildReadinessGate.branchMissing.test.ts` lesen Build-Projekte helper-first statt lokaler Any-Fixtures
- `buildStartService.readinessContract.test.ts` und `lib/__tests__/buildStartService.integration.test.ts` arbeiten ohne lokale Signatur-/Session-Casts
- `diagnosticRunners.repoSync.test.ts` nutzt jetzt `makeProjectFile(...)` und `createMountedRef(...)`

## Warum sicher
- keine Produktlogik geaendert
- nur Test-/Fixture-Typing verbessert
- Build-/Readiness-/Diagnostics-Vertraege bleiben unveraendert

## Validierung
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`
