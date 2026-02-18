# Patch 83 – ConnectionsScreen Hotfix (Typecheck)

Stand: **2026-02-12**

## Problem
Patch 82 introduced a TypeScript compile error in `useConnectionsScreen.ts`:
- `validateBeforeSave` is a `useMemo` result (a validation object), but `saveAll()` called it like a function with arguments.
- Error: `TS2554: Expected 0 arguments, but got 1.`

## Fix
- `saveAll()` now uses the memoized validation result directly:
  - `const v = validateBeforeSave;`
  - No function call, no args.

## Impact
- **UI/Optik:** keine Änderung.
- **Behavior:** identisch, nur Typecheck wieder grün.

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
