# Patch 191 — EnhancedBuildScreen: remove dead run-detail loader + add One-Click Deploy tests

Date: 2026-02-19

## Goals
- Reduce risk/complexity in EnhancedBuildScreen hook by removing unused duplicate run-detail loader code.
- Add minimal Jest coverage for the One-Click Deploy critical flow (happy + fail path).

## Changes
- Deleted unused internal helpers in `useEnhancedBuildScreen`:
  - removed `loadRunDetailsAndJobs`, `openRunDetail`, `refreshRunDetail` and a redundant `runMatch` memo.
  - kept `openRunDetails` + `refreshRunDetails` as the single supported code path.
- Added new Jest test suite for `useOneClickDeploy`:
  - fails when signing key is missing (ensures no accidental "skip")
  - passes through to build when key exists.

## Files
- screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts
- __tests__/oneClickDeploy.test.tsx
