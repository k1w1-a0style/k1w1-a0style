# Patch 477

Datum: 2026-03-17

## Ziel
One-Click-Deploy-Readiness auf dieselbe repo/branch-scoped Diagnostic-Quelle bringen wie Build-Gate, damit keine falsche Freigabe durch globalen Legacy-Status passiert.

## Änderungen
- **Technisch belastbar angepasst.** `screens/EnhancedBuildScreen/hooks/useOneClickDeploy.ts`
  - Readiness-Schritt liest `diagnostic_last_ok` jetzt zuerst über `diagnosticLastOkKeyForSelection(linkedRepo, linkedBranch)`.
  - Legacy-Key `diagnostic_last_ok` bleibt als Fallback aktiv (Migrationssicherheit).
  - Ergebnis: One-Click-Deploy und Build-Gate verwenden konsistente Diagnostic-SoT pro Repo/Branch.
- **Technisch belastbar angepasst.** `__tests__/oneClickDeploy.test.tsx`
  - Tests auf scoped Diagnostic-Key erweitert.
  - Regression abgesichert: globaler Legacy-Key darf einen negativen scoped Status nicht "grün überschreiben".

## Verifikation
- `npm run test:silent -- --runInBand __tests__/oneClickDeploy.test.tsx`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Einordnung
- Kein Broad-Refactor, nur gezielte Korrektur eines realen Flow-/Guard-Drifts.
- Kommunikationsschicht unverändert; Fokus liegt auf konsistenter technischer Readiness-Logik.
