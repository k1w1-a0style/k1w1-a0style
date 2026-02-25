# Patch 278: Fix EAS test compile regressions

## What
- Fixes TypeScript compile errors introduced around the EAS status/test flow in `useConnectionsScreen`.

## Why
- `testEas` referenced state setters that did not exist and referenced `easProjectId` before it was declared.
- The hook return object accidentally contained duplicate keys (`easOk`, `easProjectId`).

## Changes
- Declare `easProjectId` and `isTestingEas` before `testEas`.
- Replace the missing toast helper with `Alert.alert(...)` for user-visible errors.
- Remove duplicate `easOk` / `easProjectId` entries from the returned object.

## Files
- `screens/ConnectionsScreen/hooks/useConnectionsScreen.ts`
- `docs/patches/PATCHLOG_ROOT.md`
- `docs/patches/patch_278.md`
