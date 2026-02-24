# Patch 244: Hotfix import syntax in useBuildHistory

## Summary

Fixes a malformed import block introduced in Patch 243 that broke Jest parsing and TypeScript compilation.

## Changes

- `hooks/useBuildHistory.ts`
  - Move `logger` to a proper top-level import.
  - Restore the `buildHistoryStorage` named import block.
  - No behavior change intended (syntax + logging consistency only).

## Verification

- `npm run test:silent`
- `npm run typecheck`
