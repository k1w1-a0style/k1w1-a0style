# Patch 745 — AppInfo Secret-Import Status-Reset als dedizierter Helper

## Ziel

Kleine, sichere Entkopplung im AppInfo-Secret-Import-Scope:
- test-only Export aus produktivem Hook vermeiden
- Status-Reset-Logik als eigenstaendig testbaren Helper bereitstellen
- vorhandenen Storage-Reset-Vertrag unveraendert halten

## Umsetzung

1. Neue Datei `screens/AppInfoScreen/hooks/secretImportStatusReset.ts` mit `resetDerivedStatusAfterSecretImport()` erstellt.
2. `screens/AppInfoScreen/hooks/useAppInfoScreen.ts` nutzt jetzt den Helper-Import statt lokaler Inline-Implementierung; der test-only Export wurde entfernt.
3. `__tests__/appInfoSecretImportStatusReset.test.ts` importiert den Helper direkt.

## Tests / Checks

- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/appInfoSecretImportStatusReset.test.ts __tests__/previewEdgeErrorContract.test.ts`
- `npm run -s test:silent`

## Nicht-Ziele

- keine funktionale Aenderung am Secret-Import-Verhalten
- keine Workflow-/Edge-/Build-Logik-Aenderung
