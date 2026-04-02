# Patch 672 — Refactor-Durchlauf 32 (generic-any follow-up in productive helpers)

## Ziel
Die letzten produktionsnahen generischen `<any>`-Reader in App-Status- und Diagnostics-Helfern helper-first entfernen, ohne Status-/Diagnostics-/Build-Vertraege umzubauen.

## Umsetzung
- `screens/AppStatusScreen/hooks/appStatusHelpers.ts` liest `app.json` jetzt ueber lokale Unknown-/Record-Reader statt `safeJsonParse<any>`.
- `lib/diagnostics/buildPipelineDiagnostics.ts` nutzt im expo-dev-client-Check `readJsonFile<unknown>` + `readStringDeps(...)` statt `readJsonFile<any>`.
- Fokussierte Regressionen decken Non-Object-/Malformed-JSON-Pfade ab.
- README / TODO / Risk-Hotspots / Checklog / Patchlog auf Patch 672 synchronisiert.

## Verifikation
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`

## Ergebnis
Im produktionsnahen Runtime-/App-/Edge-Code bleiben jetzt keine `as any`-Reste und keine generischen `<any>`-Reader mehr uebrig; der verbleibende Non-Test-Rest ist aktuell nur noch ein Tooling-Skript.
