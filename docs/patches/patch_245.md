# Patch 245: Fix BuildHistoryEntry optional fields in useBuildHistory

## Summary

Fixes TypeScript type errors by using `undefined` (not `null`) for optional string fields in `BuildHistoryEntry`.

## Changes

- `hooks/useBuildHistory.ts`
  - Set `completedAt` and `errorMessage` to `undefined` for new history entries.
  - Ensure updates use `undefined` (not `null`) for `errorMessage` when absent.

## Verification

- `npm run test:silent`
- `npm run typecheck`
