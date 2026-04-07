# Patch 753 - Runtime-Hardening + Checklog/SilentCatch Cleanup

## Ziel
Offene Restpunkte zu HistoricalChecklogDrift, SilentCatchDebt, DisabledLegacyEdges-Dokumentation und MaxRuntimeHardening mit minimal-invasiven Aenderungen sauber schliessen.

## Umsetzung

1. Preview Runtime-Contract gehaertet
- `supabase/functions/preview_page/helpers.ts` enthaelt jetzt gemeinsame Candidate-Helfer:
  - `buildPreviewSecretCandidates(secret)`
  - `findFirstByPreviewSecretCandidates(...)`
  - `deleteByPreviewSecretCandidates(...)`
- `preview_page/index.ts` nutzt diese Laufzeit-Helfer fuer Lookup und Expiry-Delete (kein Split-Brain zwischen Pfaden).

2. MaxRuntimeHardening-Tests erweitert
- neuer runtime-naher Test `__tests__/previewSecretCandidates.runtime.test.ts` prueft ausfuehrbar:
  - hash-first + raw fallback Reihenfolge
  - hash-first Treffer fuer neue Rows
  - raw fallback fuer Legacy-Rows
  - Delete versucht beide Kandidaten
- bestehender `releaseReadiness.execution.contract` bleibt als Ausfuehrungs-Semantikschutz aktiv.

3. SilentCatchDebt in kritischen Pfaden reduziert
- stumme `.catch(() => {})` entfernt in:
  - `screens/shared/preview/useWebViewNavigation.ts`
  - `screens/GitHubReposScreen/components/RepoMetaSection.tsx`
  - `screens/DiagnosticScreen/hooks/useDiagnosticUpload.ts`
  - `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`
- stattdessen sichtbares Warn-Logging bei erhaltenem Fail-safe Verhalten.
- Guard-Test: `__tests__/silentCatchCriticalPaths.invariants.test.ts`.

4. HistoricalChecklogDrift relativiert
- `PROJECT_CHECKLOG.md` traegt jetzt expliziten Hinweis: append-only Historie, nicht alleinige Release-Wahrheit.
- Guard-Test: `__tests__/projectChecklog.truthfulness.invariants.test.ts`.

5. DisabledLegacyEdgesRemoval
- Keine riskante Entfernung in diesem Lauf; verbleibende disabled Legacy-Edges bleiben bewusst dokumentiert/guarded.
- Script-Check bleibt gruen (`check_legacy_disabled_edges.sh`).

## Validation
- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/previewEdgeErrorContract.test.ts __tests__/previewSecretCandidates.runtime.test.ts __tests__/releaseReadiness.execution.contract.test.ts __tests__/silentCatchCriticalPaths.invariants.test.ts __tests__/projectChecklog.truthfulness.invariants.test.ts`
- `npm run -s docs:lint`
- `npm run -s docs:check:contracts`
- `bash scripts/check_patch_docs_sync.sh`
- `bash scripts/check_legacy_disabled_edges.sh`
