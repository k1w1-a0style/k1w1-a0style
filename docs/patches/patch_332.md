# Patch 332: BuildPollingService Type-Hardening + Regression Tests

## Ziel
Nächsten machbaren Fixlistenpunkt umsetzen: `any`-Hotspots im Build-Polling reduzieren und kritische Response-Pfade mit Tests absichern.

## Änderungen

### 1) BuildPolling robust typisiert
- Datei: `project/services/buildPollingService.ts`
- `fetchWithTimeout`: `catch (error: unknown)` statt `any`; AbortError-Erkennung via `instanceof Error`.
- Neue Helper: `asRecord`, `readString`, `extractErrorMessage` für sichere JSON-Zugriffe ohne `any`.
- `pollBuildStatusOnce`: Response-Auswertung (`job`, `data.job`, `urls`, `runId`, `buildUrl`) auf typed unknown/object Guards umgestellt.

### 2) Regressionstests ergänzt
- Datei: `__tests__/buildPollingService.test.ts`
- Testfälle:
  - non-JSON Response liefert sauber `Ungültige Server-Antwort`
  - Legacy-Felder (`run_id`, `download_url`) werden korrekt gelesen
  - AbortError wird in Timeout-Fehlertext übersetzt

## Warum sicher
- Keine Änderung an öffentlichen API-Signaturen.
- Funktionales Verhalten bleibt erhalten, nur Fehler-/Parsingpfade sind strikter typisiert.
- Vollständige Standard-Checks grün.

## Validierung
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
