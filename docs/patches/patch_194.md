# Patch 194 — EnhancedBuildScreen hook split (no behavior change)

Date: 2026-02-19

## Goals
- Reduce `useEnhancedBuildScreen` complexity without changing runtime behavior.
- Make future bugfixes safer by isolating helpers and precondition checks.

## Changes
- Extracted reusable helpers into `screens/EnhancedBuildScreen/hooks/buildScreenHelpers.ts`:
  - `sanitizeUiMessage`, `withTimeout`, `validateRepoFullName`, `fetchRunDetailsBundle`
  - Central constants: `FETCH_TIMEOUT_MS`, `MAX_ALERT_MESSAGE_LEN`
- Extracted build precondition checks into `screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts`:
  - Tokens (GitHub + Expo)
  - Signing key presence (profile-aware)
  - Diagnostic last OK flag
- Updated `useEnhancedBuildScreen` to consume the new helper module + preconditions hook.

## Notes
- Intended as a refactor-only patch.
- Also backfills PatchLog/Checklog entries for Patch 192.2 and Patch 192.3 (docs existed but were not listed).
