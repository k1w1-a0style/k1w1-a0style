# Patch 334: Single-Source-of-Truth Projektdokumentation (State + Build-Pipeline)

## Ziel
Verbindliche technische Dokumentation für globalen Zustand, Persistenzregeln und Buildflow erstellen (inkl. Evidence-Pflicht).

## Enthaltene Dateien
- `docs/00-overview.md`
- `docs/01-state-contract.md`
- `docs/02-build-pipeline.md`
- `docs/03-screen-index.md`
- `docs/04-risk-hotspots.md`

## Inhalte
- SoT-Definition für Repo/Branch/BuildProfile + persistente Statuswerte.
- E2E Build Contract von UI bis `startBuildJob`/Dispatch.
- Verbotene Muster dokumentiert (u.a. `main`-Fallbacks, lokale Schattenkopien).
- Screen-Index als reine Navigationshilfe.
- Risk-Hotspots mit konkreten Fundstellen und Fix-Vorschlägen.

## Validierung
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
