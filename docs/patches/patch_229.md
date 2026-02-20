# Patch 229: CI Lite utils extraction (SoT polish)

## Ziel
- `components/CiLiteHeaderButton.tsx` war schwer zu lesen, weil Utility-Logik (State-Inferenz, Sanitizing, Preflight-Patch-Normalisierung) direkt im Component lag.

## Änderung
- Neue Utility-Datei: `components/ciLite/ciLiteUtils.ts`
  - `safeUi()` (Redaction + Truncation)
  - `inferStepStates()` (TS/ESLint Status aus CI-Output)
  - `normalizePreflightPatch()` (Preflight Patch JSON Normalisierung)
  - `StepState` Typ
- `CiLiteHeaderButton` nutzt jetzt die extrahierten Helpers.

## Risiko
- Sehr niedrig: reine Extraktion ohne Behavior-Änderung.

