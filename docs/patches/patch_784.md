# Patch 784 - StagedScreenRegressionFollowup

## Datum
2026-04-18

## Ziel
Nachzug und Verbreiterung der staged Flow-Regressionen mit Fokus auf screen-nahe Abläufe:
- Projektwechsel-Reset von `pendingPlan` / `pendingChange`
- Retry/Fallback-Verhalten nach fehlgeschlagener Auto-Fortsetzung
- dedizierter Abort/Retry-Timing-Pfad bei in-flight Auto-Continue

## Umgesetzter Scope
- Neue/erweiterte Regressionstests in:
  - `__tests__/useChatAIFlow.stagedScreenRegression.test.tsx`
  - `__tests__/useChatAIFlow.stagedAutoContinue.integration.test.tsx`
- Keine Laufzeitlogik geändert, nur Test- und Doku-Nachzug.

## Verifikation
- `npm run test:silent` ✅ (449/449 Suites)
- `npm run edge:check` ✅
- `npm run docs:lint` ✅
- `npm run docs:check:contracts` ✅
- `npm run verify:release` ✅ `OK_WITH_SKIPS` (Live-Checks ohne gesetzte `EDGE_BASE_URL`/`EDGE_OPERATOR_JWT` lokal erwartbar geskippt)

## Drift-Check
- Kern-MDs aktiv gegengeprüft:
  - `README.md`
  - `docs/TODO.md`
  - `docs/INDEX.md`
  - `docs/TESTING_GUIDE.md`
  - `docs/FRESH_CHECKOUT_GREEN_PATH.md`
  - `PROJECT_CHECKLOG.md`
  - `docs/patches/PATCHLOG_ROOT.md`
- Stände wurden auf Patch 784 synchronisiert.
