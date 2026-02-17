# Patch 182: CI Lite progress hotfix (TypeScript)

## Summary
Hotfix for Patch 181 (CI Lite progress bar + shimmer).

### Fixes
- Replace invalid `theme.palette.danger` with `theme.palette.error`.
- Add missing StyleSheet keys referenced by the progress UI:
  - `progressWrap`, `progressMetaRow`, `progressLabel`, `progressPct`, `progressTrack`, `progressFill`, `progressShimmer`

## Files changed
- `components/CiLiteHeaderButton.tsx`

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent`
- In-app: open CI Lite, start a run, verify progress bar + shimmer render and no crash
