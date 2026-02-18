# Patch 84 Notes

## Scope
ConnectionsScreen hotfix to restore TypeScript typecheck after `validateBeforeSave` shape drift.

## What changed
- `saveAll()` now treats `validateBeforeSave` robustly:
  - if it is a function, it is called with **no arguments**;
  - otherwise it is treated as the memoized validation result object.

## Why
Different refactors can leave `validateBeforeSave` as either:
- a memoized result object (`useMemo`), or
- a callback returning that object (`useCallback`).

Assuming the wrong shape breaks typecheck (`v.ok/title/message` on a function).

## UI impact
None.

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
