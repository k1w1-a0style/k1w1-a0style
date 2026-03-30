# Patch 636 — finaler Test-Audit + deterministisches Fixbeispiel

## Ziel

Den angefragten finalen Test-Audit mit einem konkreten, kleinen Verbesserungsfix abschliessen und die Review-/Patch-Doku auf denselben Stand bringen.

## Änderungen

1. **Determinismus-Fix in Freshness-Test**
   - Datei: `__tests__/buildReadinessGate.ciLiteFreshness.test.ts`
   - Vorher: mehrere direkte `Date.now()`-Aufrufe in Fixture-/Freshness-Pfaden.
   - Jetzt:
     - `FIXED_NOW` als feste Zeitbasis
     - `jest.spyOn(Date, "now").mockReturnValue(FIXED_NOW)` in `beforeEach`
     - `jest.restoreAllMocks()` in `afterEach`
   - Effekt: reproduzierbarere Freshness-Assertions, weniger Zeitdrift-Rauschen.

2. **Review-Aktualisierung (Test-Audit)**
   - Datei: `docs/reviews/deep-scan-review-2026-03-30.md`
   - Neuer Abschnitt:
     - bereits umgesetztes Fixbeispiel
     - weitere priorisierte Test-Verbesserungen (P1/P2)
     - Begründung und konkrete Fixoptionen

3. **Patch-Doku-Sync**
   - `README.md`
   - `PROJECT_CHECKLOG.md`
   - `docs/TODO.md`
   - `docs/patches/PATCHLOG_ROOT.md`

## Verifikation

- `npm run test:silent -- --runInBand __tests__/buildReadinessGate.ciLiteFreshness.test.ts`
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- `node scripts/docsLint.js`
- `bash scripts/check_patch_docs_sync.sh`
- `git diff --check`
