# Patch 755 - Diagnostic Upload Catch-Mismatch + Runtime Follow-up

## Ziel
Offene PR-574-Restpunkte abschliessen: DiagnosticUploadSilentCatchMismatch, RemainingSilentCatchDebt im kritischen Scope, DisabledLegacyEdges execution-nahe Absicherung und RuntimeHardeningFollowup.

## Umsetzung
1. DiagnosticUploadSilentCatchMismatch
- `screens/DiagnosticScreen/hooks/useDiagnosticUpload.ts`
  - Persisted-Cooldown-Load hat kein stummes `catch {}` mehr.
  - stattdessen sichtbares `console.warn(...)`, fail-safe Verhalten bleibt erhalten.

2. RemainingSilentCatchDebt (kritischer Scope)
- Preview-/Fullscreen-/Build-/Diagnostic-relevante Catch-Pfade bleiben sichtbar; neuer Hook-Runtime-Test prueft die relevanten Warnpfade explizit.

3. DisabledLegacyEdgesRemoval (risk-aware)
- keine riskante Entfernung in diesem Lauf.
- execution-naher Contract-Test fuer `scripts/check_legacy_disabled_edges.sh` hinzugefuegt:
  - pass bei korrekt disabled+guarded Fixture
  - fail bei Drift (fehlendes `status: 410`)

4. RuntimeHardeningFollowup
- neuer Hook-Runtime-Test `__tests__/useDiagnosticUpload.silentCatchFollowup.test.tsx`:
  - persisted cooldown load warning
  - device-id read warning
  - RNG fallback warning
  - persist warning
- vorhandene runtime-nahe preview/release/rate-limit guards bleiben aktiv und wurden erneut mitgeprueft.

## Validation
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/useDiagnosticUpload.silentCatchFollowup.test.tsx __tests__/legacyDisabledEdges.execution.contract.test.ts __tests__/previewSecretCandidates.runtime.test.ts __tests__/previewEdgeErrorContract.test.ts __tests__/releaseReadiness.execution.contract.test.ts __tests__/silentCatchCriticalPaths.invariants.test.ts __tests__/projectChecklog.truthfulness.invariants.test.ts`
- `npm run -s docs:lint`
- `npm run -s docs:check:contracts`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
