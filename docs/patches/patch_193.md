# Patch 193 — EnhancedBuildScreen: reduce duplication in run-details loading

## Goal
Make `useEnhancedBuildScreen` a bit less "spaghetti" without changing behavior.

## What changed
- Extracted a small helper `fetchRunDetailsBundle()` used by `openRunDetails()`.
- Keeps the same timeout + parallel fetch logic, but removes duplicated array/shape handling in the callback.

## Files changed
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
- `docs/patches/patch_193.md`
- `docs/patches/PATCHLOG_ROOT.md`
- `PROJECT_CHECKLOG.md`
