# Patch 94 Notes

Date: **2026-02-13**

## Changes

### GitHubReposScreen
- Repo list rendering is now **virtualized** using a **root `FlatList`** (instead of mapping inside a `ScrollView`).
  - Prevents `VirtualizedList` nesting warnings.
  - Scales better for large repo counts.
- Added basic integration-ish tests for the critical list flows:
  - show/hide behavior
  - empty state
  - selecting a repo item calls the selection handler with the correct repo

## UI / Optik
- No intended visual changes.

## Validation
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent` ✅
