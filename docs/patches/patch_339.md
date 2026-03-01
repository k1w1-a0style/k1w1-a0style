# Patch 339 — Phase 4: Testability DX + Mini-Refactors + Med UI Tests

Datum: 2026-03-01

## Änderungen

1. Testability-Refactors (low risk, ohne Produktlogik-Änderung)
- Build-Readiness Gate:
  - stabile Error-Codes in `lib/errors/buildReadinessErrors.ts`
  - `assertBuildReadiness(project, deps?)` mit DI-Hook `storageGetItem`
- Pipeline Diagnostics:
  - `runBuildPipelineDiagnostics(params, deps?)` mit optionalen Service-Dependencies
- Preflight Runner/Checks:
  - `PRECHECKS_REGISTRY`, `getPreflightCheckById`, `runPreflightChecks` exportiert
  - Runner akzeptiert optional injizierte Check-Listen
- Patch Engine:
  - kanonischer Export `applyPatch` (Alias bleibt `applyPreflightPatch`)

2. UI/Wiring
- Diagnostics-Checkliste sortiert stabil nach Status-Reihenfolge `fail -> warn -> pass`.

3. Neue Med-Tests
- Diagnostics list sorting
- SmartFix fixable-only behavior
- Runner resilience bei throwendem Einzel-Check
- Build-Readiness Tests auf stabile Error-Codes erweitert

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
