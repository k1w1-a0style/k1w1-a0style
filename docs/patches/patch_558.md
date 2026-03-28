# Patch 558 — CI-Lite Artifact-Detail + Polling-Backoff-Haertung

## Kontext

Im CI-Lite-Header gab es zwei echte CI-Lite-Restpunkte:

1. Artifact-Notice verlor den relevanten `artifactError`-Detailkontext weitgehend und zeigte meist nur generische Meldungen.
2. Run-Lookup nutzte starres `setInterval(..., 2500)` (Dispatch + Autofix-Chain) ohne progressives Bremsen.

## Umsetzung

1. Artifact-UI-Hinweise in `useCiLiteWorkflow` verbessert:
   - neue lokale Detail-Sanitization (`sanitizeArtifactDetail`) fuer Artifact-Fehlertexte
   - sensible Header-/Token-Muster werden redacted (`Authorization: Bearer ...`, `x-k1w1-admin-key`, `gh*_*`)
   - Detailtext wird auf max. 180 Zeichen begrenzt
   - die bestehende klare Hauptsprache bleibt erhalten; der Detailhinweis wird nur ergaenzt (`Detail: ...`)
   - Erfolgspfad bleibt explizit erkennbar: „Workflow erfolgreich, Artifact/Nachzug fehlgeschlagen“

2. Polling lokal gehaertet, ohne Architekturumbau:
   - starres Intervall ersetzt durch `setTimeout`-basierten kleinen Backoff-Scheduler
   - Delay-Stufen: `1200 -> 1800 -> 2600 -> 3500 -> 4500ms` (gedeckelt)
   - gilt fuer manuellen Workflow-Run-Lookup und Autofix-Chain-Run-Lookup
   - bestehende Gesamt-Timeouts (60s / 75s) bleiben unveraendert
   - bestehende Stop-/Cleanup-Pfade (`stopRunLookup`, `stopPolling`, Unmount-Cleanup) bleiben erhalten

3. Regressionstests gezielt erweitert:
   - Hook-Test deckt jetzt explizit ab, dass Artifact-Notice den Detailhinweis sichtbar enthaelt, ohne rohe Secret-Werte zu leaken
   - Hook-Test deckt den neuen progressiven Polling-Backoff sichtbar ueber Timer-Stufen ab
   - Header-Button-Test deckt Artifact-Notice mit Detailtext im Modal sichtbar ab

## Geaenderte Dateien

- `components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts`
- `__tests__/useCiLiteWorkflow.behavior.test.tsx`
- `__tests__/ciLiteHeaderButton.behavior.test.tsx`
- `README.md`
- `docs/patches/patch_558.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`

## Validierung

- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `npm run test:silent -- --runInBand __tests__/useCiLiteWorkflow.behavior.test.tsx __tests__/ciLiteHeaderButton.behavior.test.tsx`
- `git diff --check`
- `bash scripts/check_patch_docs_sync.sh`
