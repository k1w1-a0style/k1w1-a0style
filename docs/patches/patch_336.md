# Patch 336: Build Readiness Gate Contract dokumentiert

## Ziel
Den Buildflow gegen fehlende Voraussetzungen "wasserdicht" spezifizieren, basierend auf dem bestehenden Global State & Persistence Contract.

## Änderungen
- Neue verbindliche Gate-Doku erstellt: `docs/06-build-readiness.md`
  - Profilabhängige Preconditions (development/preview/production)
  - Vollständige Build Readiness Matrix mit Pflichtgrad, Validierung, Blocker/Warnung, AutoFix-Pfad
  - Single Entry Point Definition (`startBuildJob`) inkl. Durchsetzungsregeln
  - Evidence-Pflicht pro Matrix-Item mit Datei/Symbol/Codeauszug
- `docs/02-build-pipeline.md` aktualisiert:
  - UI-Gate + Service-Gate sauber getrennt
  - Blocker/Warnung verbindlich definiert
  - Single Entry Point verankert
  - Risiken der aktuellen Fallbacks explizit markiert

## Validierung
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
