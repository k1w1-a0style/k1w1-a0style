# Patch 674 — Refactor-Durchlauf 34 (test/fixture typing cleanup wave 1)

## Ziel
Den ersten fokussierten Test-/Fixture-Debt-Block in den juengst refactorten Bereichen helper-first reduzieren, ohne produktive Vertraege anzufassen.

## Umgesetzt
- neue Test-Helper in `__tests__/helpers/diagnosticTestHelpers.ts`:
  - `findCheckById(...)`
  - `makeProjectFile(...)`
  - `pluckIds(...)`
- `__tests__/diagnosticChecksJsonReaders.test.ts` nutzt `ProjectFile`-Fixtures statt `as any`
- `__tests__/diagnosticIssueFiltering.test.tsx` nutzt echte `PreflightCheckResult`-Objekte plus `pluckIds(...)`
- mehrere Pipeline-Diagnostics-Tests lesen Checks jetzt ueber `findCheckById(...)` statt `(c: any) => c.id`
- `__tests__/pipelineDiagnostics.easCanonicalMergePreservesCustom.test.ts` nutzt `ProjectFile[]` statt `files as any`
- `__tests__/appInfoSecureBackup.test.ts` nutzt `AIConfig` plus Union-Narrowing statt `baseConfig: any` / `restored as any`

## Nicht angefasst
- Build-/Readiness-/AsyncStorage-Testcluster
- Notification-/Retry-/Auth-/fetch-nahe Test-Mocks
- produktiver Runtime-/App-/Edge-/Helper-Code

## Validation
- `bash scripts/check_patch_docs_sync.sh`
- `node scripts/docsLint.js`
