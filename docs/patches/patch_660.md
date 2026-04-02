# Patch 660 — Refactor-Durchlauf 20 (JSON typing/helper-first)

## Ziel

Den in Patch 656 bewusst nur halb nachgezogenen `jsonUtils`-Typing-Block jetzt sauber abschliessen, ohne Template-/Checklist-Logik umzubauen.

## Umsetzung

- `lib/diagnostics/templates/jsonUtils.ts` fuehrt jetzt ein:
  - `JsonRecord`
  - `isJsonRecord(...)`
  - `getErrorMessage(...)`
- `ensureObj(...)` gibt damit nicht mehr implizit `any`, sondern einen engen `Record<string, unknown>`-Vertrag zurueck.
- `patchAppJson(...)`, `patchPackageJson(...)` und `patchEasJson(...)` ziehen die Nested-Objekte jetzt ueber lokale getypte Records (`expo`, `expoAndroid`, `splash`, `adaptiveIcon`, `dependencies`, `devDependencies`, `scripts`, `cli`, `build`) sauber nach.
- Catch-Pfade in allen drei Patchern laufen ueber `unknown` + gemeinsamen Error-Message-Helper.

## Tests

- Neue fokussierte Regression: `__tests__/jsonUtils.patchers.test.ts`
  - `ensureObj(...)` normalisiert Nicht-Objekte weiter konservativ zu `{}`
  - `majorOf(...)` bleibt semver-tolerant
  - `patchAppJson(...)` behaelt Nested-Defaulting bei
  - `patchPackageJson(...)` behaelt die Fallback-Semantik fuer Non-Object-Payloads bei
  - `patchEasJson(...)` behaelt CLI-/Build-Defaults bei

## Ergebnis

- Der bislang offene Rueckgabe-/Caller-Vertrag rund um `jsonUtils.ts` ist jetzt sauber geschlossen.
- Kein Template-/Checklist-/Flow-Vertragsumbau.
- Naechster produktionsnaher Typing-Hebel liegt jetzt klarer bei `lib/logger.ts`, `supabase/functions/android-keystore-generate/helpers.ts`, `infra/github/compare.ts` und `infra/github/user.ts`.
