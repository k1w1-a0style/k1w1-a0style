# Patch 56 – Preview hotfix (typing)

## Summary
Fixes remaining TypeScript errors after Patch 54/55.

## Changes
- **PreviewFullscreenScreen**
  - Remove unreachable `mode === "none"` branch (mode is now `null | "html" | "url"`).
- **PreviewScreen**
  - `lastCreatedAt` is stored as a millisecond timestamp (number). Convert to ISO string before calling date helpers.

## Files
- `screens/PreviewFullscreenScreen.tsx`
- `screens/PreviewScreen.tsx`
- `docs/patches/PATCH_56_NOTES.md`
- `PROJECT_CHECKLOG.md`

## Checks
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
