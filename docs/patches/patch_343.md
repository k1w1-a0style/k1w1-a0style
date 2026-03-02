# Patch 343 — Docs Finalization Pack (Runbook + Product Flows + Screen Map + SoT Quickref + Docs-Lint)

Datum: 2026-03-02

## Ziel
Operator-/QA-Dokumentation so finalisieren, dass neue Devs den Build-/Diagnostics-Flow in kurzer Zeit reproduzierbar verstehen und ausführen können.

## Änderungen
- `docs/10-product-and-flows.md` auf Executive+Operator-Struktur gebracht: Kern-Journeys, Failure-Paths, Non-Goals und operative Referenzen.
- `docs/runbooks/APP_RUNBOOK.md` erweitert: 5-Min-Quickstart, Troubleshooting-Tabelle inkl. Check-IDs, Incident-Checklist, Re-run-Strategie.
- `docs/13-screen-flow-map.md` ergänzt: Screen-Matrix (Purpose, Actions, Hooks/Services, Diagnostics-Bezug) + Mermaid E2E-Flow.
- `docs/14-state-quickref.md` konsolidiert: SoT pro Domäne, persistente Keys inkl. GitHub-Keys, Ephemeral State, Migration/Backup, Persistenz-Tests.
- `docs/12-release-readiness-report.md` konsistent aktualisiert (Status + Test-Summary + Phase-8 wording).
- `docs/04-testing-smoke-plan.md` um `npm run docs:lint` erweitert.
- `scripts/docsLint.js` Check-ID-Filter korrigiert (robustere Erkennung der IDs aus `docs/07`).

## Verifikation
- `npm run docs:lint`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Hinweise
- Keine Runtime- oder Dependency-Änderungen.
- Fokus ausschließlich auf Doku-Konsistenz und vorhandene, aus Code belegte Flows.
