# Patch 58 Notes

## Fixes
- Fix TypeScript/Jest parse error in `FileActionsModal` by removing `await` from a non-async `Alert` button handler (wrap async work in a void async IIFE).

## Impact
- No UI/visual changes; behavior is unchanged (delete still waits before closing), but builds/tests no longer fail.
