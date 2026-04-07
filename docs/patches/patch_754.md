# Patch 754 - SilentCatch Follow-up + Preview Format Runtime Guard

## Ziel
Offene Restkante bei SilentCatchDebt und Runtime-Haertung ohne Grossumbau schliessen.

## Umsetzung
1. SilentCatch Follow-up
- `screens/PreviewFullscreenScreen/hooks/usePreviewFullscreen.ts`:
  - URL-Parse-Guard nutzt kein stummes `catch {}` mehr, sondern loggt Warnung und bleibt fail-closed.
- `screens/DiagnosticScreen/hooks/useDiagnosticUpload.ts`:
  - Device-ID-/Random-/Persist-Fallbacks loggen Fehler jetzt sichtbar statt still zu schlucken.

2. Preview Runtime Guard
- `supabase/functions/preview_page/helpers.ts`:
  - neuer shared Guard `isValidPreviewSecretFormat(secret)`.
- `supabase/functions/preview_page/index.ts`:
  - produktiver Secret-Validierungspfad nutzt den shared Guard.

3. Runtime-Test-Erweiterung
- `__tests__/previewSecretCandidates.runtime.test.ts` erweitert um missing/invalid/valid Secret-Format-Faelle.
- `__tests__/silentCatchCriticalPaths.invariants.test.ts` deckt zusaetzlich `usePreviewFullscreen` im kritischen Pfad ab.

## Validation
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/previewEdgeErrorContract.test.ts __tests__/previewSecretCandidates.runtime.test.ts __tests__/releaseReadiness.execution.contract.test.ts __tests__/silentCatchCriticalPaths.invariants.test.ts __tests__/projectChecklog.truthfulness.invariants.test.ts`
- `npm run -s docs:lint`
- `npm run -s docs:check:contracts`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
