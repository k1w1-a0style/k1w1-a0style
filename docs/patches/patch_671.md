# Patch 671 - Refactor-Durchlauf 31 (diagnostic checks JSON typing)

## Ziel

Die verbliebenen `parseJson<any>(...)`-Pfade in den produktionsnahen Diagnostic-Checks helper-first auf kleine Unknown-/Record-Reader ziehen, ohne Check-/Autofix-Logik umzubauen.

## Umgesetzt

- `lib/diagnostics/checks/qualityAndCompat.ts` nutzt jetzt kleine Record-/Dependency-Reader statt `parseJson<any>(...)` fuer `package.json`.
- `lib/diagnostics/checks/packageAndEntry.ts` liest `package.json.main` ueber kleine Unknown-/String-Reader statt `parseJson<any>(...)`.
- `lib/diagnostics/checks/configAndProfiles.ts` nutzt fuer `eas.json`, `app.json` und `package.json` kleine Unknown-/Record-/String-Reader statt `parseJson<any>(...)`.
- Neuer fokussierter Regressionstest `__tests__/diagnosticChecksJsonReaders.test.ts` deckt Non-Object-/Missing-Profile-/Missing-Dependency-Pfade ab.

## Verifikation

- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Hinweis

Es wurde bewusst nur der Diagnostic-checks-JSON-Block nachgezogen; keine Check-/Autofix-/Diagnose-Logik wurde umgebaut.
