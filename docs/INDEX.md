# Dokumentations-Index

Stand: **2026-03-31 (Patch 643)**

Dieser Index priorisiert operative Navigation. Historische Details bleiben im Patchlog.

## 1) Kern-Dokumente (zuerst lesen)

1. `docs/00-overview.md` — Architektur, Verträge, SoT-Leitplanken
2. `docs/10-product-and-flows.md` — Produktfluss, Operator-Journeys, erwartete Ergebnisse
3. `docs/03-screen-index.md` — Screen-Zwecke + primäre Aktionen
4. `docs/13-screen-flow-map.md` — kompakte End-to-End-Flow-Map
5. `docs/TODO.md` — offene operative und technische Follow-ups

## 2) Betrieb / Qualität

- `docs/FRESH_CHECKOUT_GREEN_PATH.md` — zentraler Verifikationspfad fuer frische Checkouts
- `docs/04-testing-smoke-plan.md` — Smoke-Plan
- `docs/06-build-readiness.md` — Build-Gate/Readiness
- `docs/07-diagnostics-fix-playbook.md` — Diagnostics-/Fix-Playbook
- `docs/08-test-coverage-matrix.md` — Test-Matrix
- `docs/09-gap-tickets.md` — offene Gap-/Ticket-Sammlung
- [EDGE_FUNCTIONS_STATUS](EDGE_FUNCTIONS_STATUS.md) — Edge-Functions-Statusübersicht
- `docs/runbooks/APP_RUNBOOK.md` — Schritt-für-Schritt-Runbook

## 3) Patching / Historie

- `docs/WORKFLOW_PATCHING.md` — verbindlicher Patch-Workflow
- `docs/patches/PATCHLOG_ROOT.md` — append-only Patchübersicht
- `docs/patches/patch_*.md` — einzelne Patchnotizen
- `PROJECT_CHECKLOG.md` — kurzer laufender Checklog
- `docs/PROJECT_TODO.md` — **historische** TODO-/Patchliste (aktive Restpunkte: `docs/TODO.md`)

## 4) Verlässliche Referenzpunkte

- Branch-basierte CI-Lite-Chain ist als dokumentierte Ausnahme erlaubt.
- Produktive Deploy-/Workflow-Flows bleiben explizit ref-gesteuert (kein stiller Default-Branch-Fallback).
- Build-Job-Vertrag: positive numerische `jobId`.
- Diagnostics-Upload-ID: clientseitig opaque string.
