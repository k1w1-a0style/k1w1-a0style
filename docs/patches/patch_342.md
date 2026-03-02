# Patch 342 (2026-03-02) – Documentation Hardening (Runbook + Product Docs + Flow Map + State Quickref)

## Ziel
Dokumentation für neue Dev/QA so schärfen, dass Produktzweck, Hauptflüsse, Gate/Fix-Loop und State-SoT in kurzer Zeit nachvollziehbar sind.

## Änderungen
- `docs/10-product-and-flows.md` konkretisiert (One-liner, 5 Journeys inkl. Failure-Pfade, Non-goals).
- `docs/runbooks/APP_RUNBOOK.md` auf Operator-Level erweitert (Quick Start, Troubleshooting Map, Security, Incident Checklist, Retry Policy).
- `docs/03-screen-index.md` als konkrete Screen→Action→Contract Matrix aktualisiert.
- Neue Datei `docs/13-screen-flow-map.md` mit textuellem Flow + Mermaid.
- Neue Datei `docs/14-state-quickref.md` für Persistenz/ephemeral/SoT-Kompaktreferenz.
- `docs/00-overview.md`, `docs/01-state-contract.md`, `docs/02-build-pipeline.md`, `docs/12-release-readiness-report.md`, `docs/INDEX.md` konsistent aktualisiert.
- Neues Script `scripts/docsLint.js` ergänzt und via `npm run docs:lint` in `package.json` eingebunden.

## Verifikation
- `npm run docs:lint`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
