# Patch 253: fix notificationService Jest token (Platform.OS safe)

## Problem
`NotificationService.initialize()` could throw inside the push-token block when `Platform` is undefined in Jest (tests mock a different Platform module path).
The exception is caught and the token is never set, so `getPushToken()` returns null and the test fails.

## Fix
Use optional chaining (`Platform?.OS`) consistently in the push-token skip check to avoid a TypeError in Jest.

## Files changed
- lib/notificationService.ts
- docs/patches/patch_253.md
- docs/patches/PATCHLOG_ROOT.md
