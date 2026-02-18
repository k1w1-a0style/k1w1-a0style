# Patch 97 Notes

Ziel: **CS-006** abschließen (Security-/Regression-Tests für ConnectionsScreen Validation/Sanitization) ohne UI-Änderung.

## Änderungen
- Neu: `screens/ConnectionsScreen/utils/validation.ts` (pure helpers)
  - `deriveSupabaseUrl` (URL/ProjectId Normalization)
  - `validateBeforeSave` (Basiskontrolle Tokens/Keys)
  - `safeAlertText` (Secret-Redaction + Truncation)
- Neu: `__tests__/connectionsScreen.validation.test.ts` (Jest Tests)

## Risiko
- Niedrig: Refactor ist internal (gleiche UI, gleiche Save-Flow-Checks), Tests sichern Verhalten ab.

## Manuelle Checks
- ConnectionsScreen öffnen → Tokens/Keys eingeben → Save → Validierungs-Alerts wie erwartet.
