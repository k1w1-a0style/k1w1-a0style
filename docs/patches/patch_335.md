# Patch 335: Contract-Test Coverage Matrix + priorisierte Smoke/Invariant-Testvorschläge

## Ziel
Auf Basis der vorhandenen Contract-Doku (`docs/01-state-contract.md`) den aktuellen Testabdeckungsstand gegen Invarianten bewerten und die wichtigsten zusätzlichen QA-Tests priorisieren.

## Enthaltene Dateien
- `docs/05-contract-test-coverage-matrix.md`
- `docs/patches/patch_335.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`

## Inhalte
- Coverage-Matrix: Invariante → bestehende Tests → Lücken → Priorität.
- Fokusanalyse zu Branch-Fallbacks, Doppel-SoT-Risiko (`active*` vs `linked*`) und Restart-Persistenz.
- Priorisierte Liste mit 12 neuen Smoke/Integration/Invariant-Tests.
- 5 Copy-Paste „Invariant String Tests" für schnelle Drift-Erkennung.
- Top-3 Contract-Brecher mit Begründung.

## Validierung
```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```
