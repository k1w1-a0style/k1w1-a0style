# Patch 86 Notes

## Summary
Hotfix for EnhancedBuildScreen typecheck: removed `status === "running"` comparison.

## Why
The project uses a centralized `BuildStatus` union (`idle | queued | building | success | failed | error`).  
`running` is not part of that union, so the comparison caused TS2367.

## Impact
- **UI:** no change
- **Behavior:** no change (ETA ticking still works for `queued`/`building`)
- **Risk:** very low (compile-time fix)

## Files
- `screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts`
- `PROJECT_CHECKLOG.md`
- `docs/TODO.md`
- `docs/reviews/BUILD_SCREEN_VERIFICATION.md`
- `docs/reviews/TERMINAL_SCREEN_VERIFICATION.md`
