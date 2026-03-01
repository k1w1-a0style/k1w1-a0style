# Patch 337 — Diagnostics Fix Playbook + Test Coverage Matrix + Smoke-Plan Sync

## Ziel
Build-Readiness aus `docs/06-build-readiness.md` operationalisieren: pro Diagnostic-Check klarer Fixpfad (AutoFix/Manual), Gap-Analyse und priorisierte Testplanung.

## Änderungen
- Neu: `docs/07-diagnostics-fix-playbook.md`
  - Vollständiges Diagnostic-Inventar (Pipeline + Local Preflight)
  - Mapping auf Build-Readiness Items
  - „Diagnostics → Fix Playbook“-Tabelle inkl. Blockerstatus, AutoFix-Aktion, Manual Steps, Re-Checks
  - Gap-Analyse für Blocker ohne belastbaren Fixpfad

- Neu: `docs/08-test-coverage-matrix.md`
  - Coverage-Matrix Build-Readiness Invarianten vs bestehende Tests
  - 18 priorisierte neue Tests (High/Med) mit Assertions + Mocks
  - 8 Invariant-String-Tests als schnelle Regression Guards

- Neu/Sync: `docs/04-testing-smoke-plan.md`
  - Smoke-Matrix auf Basis Readiness + Diagnostics
  - Priorisierte High/Med Smoke-Testliste konsolidiert
  - Exit-Kriterien für „build-startbar“ präzisiert

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`

## Risiko
- Nur Dokumentationsänderungen; kein Runtime-Code geändert.
