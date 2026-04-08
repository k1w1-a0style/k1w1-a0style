# Patch 760 — LocalRemoteDiffSectionRefactor + RefactorSoTDrift

## Ziel

- `LocalRemoteDiffSectionRefactor` vollstaendig abschliessen (kein Teil-Split).
- `RefactorSoTDrift` direkt mitziehen und fuehrende SoT auf den echten Umsetzungsstand bringen.

## Umsetzung

### 1) LocalRemoteDiffSection vollstaendig zerlegt

Die bisherige Monolith-Datei `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx`
wurde in klar getrennte Verantwortungen aufgeteilt:

- `screens/GitHubReposScreen/components/LocalRemoteDiffSection/index.tsx`
  - Container/UI-Orchestrator.
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection/useLocalRemoteDiffModel.ts`
  - Laden, Async-Request-Guards, Selection-State, Preview-Cache, Inline-/Modal-Preview-State.
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection/diffAlgorithms.ts`
  - pure Diff-/Line-Helper (`unifiedLineDiff`, `compactUnifiedDiff`, `diffLineStyle`, `safeSliceLines`, Status-Mapping).
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection/fingerprint.ts`
  - pure Fingerprint-/Hash-Helfer.
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection/LocalRemoteDiffList.tsx`
  - reine Listen-/Selection-/Inline-Preview-UI.
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection/DiffPreviewModal.tsx`
  - reine Modal-UI.
- `screens/GitHubReposScreen/components/LocalRemoteDiffSection/types.ts`
  - lokale Diff-/Preview-/Section-Typen.

Kompatibilitaet:

- `screens/GitHubReposScreen/components/LocalRemoteDiffSection.tsx` bleibt als schlanker Re-Export bestehen,
  damit bestehende Imports/Invariants stabil bleiben.

### 2) Diff-Semantik-/Marker-Regressionen

Neue gezielte Regression:

- `__tests__/localRemoteDiffSection.diffAlgorithms.test.ts`
  - Status-Glyph-Mapping
  - deterministische Unified-Diff-Semantik
  - Huge-Diff-Guard
  - Compact-Diff-Kuerzung
  - Line-Slice/Style-Grundverhalten

### 3) SoT-Drift geschlossen

Führende SoT-Dateien wurden auf den echten Stand gezogen:

- `README.md`
- `docs/TODO.md`
- `docs/reviews/Review.md`
- `docs/INDEX.md`
- `docs/TESTING_GUIDE.md`
- `docs/FRESH_CHECKOUT_GREEN_PATH.md`
- `PROJECT_CHECKLOG.md`
- `docs/patches/PATCHLOG_ROOT.md`

Die bisherigen Analyse-only-Header (`Patch 759`) wurden auf den abgeschlossenen Refactor-Stand (`Patch 760`) aktualisiert.

## Verifikation

- `npm run -s typecheck`
- `npm run -s lint:ci`
- `npm run -s test:silent -- --runInBand __tests__/localRemoteDiffSection.diffAlgorithms.test.ts`
- `npm run -s test:silent -- --runInBand __tests__/localRemoteDiffSection.truthfulness.test.tsx`
- `npm run -s test:silent -- --runInBand __tests__/githubReposScreen.list.test.tsx`
- `npm run -s test:silent -- --runInBand __tests__/githubReposScreen.pullPushSemantics.test.ts`
- `npm run -s test:silent -- --runInBand __tests__/patch462.githubReposScreen.restFixes.invariants.test.ts`
- `npm run -s test:silent -- --runInBand __tests__/patch483.githubReposScreen.step8.invariants.test.ts`
- `bash scripts/check_patch_docs_sync.sh`
- `npm run -s docs:lint`
