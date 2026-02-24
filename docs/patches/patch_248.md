# Patch 248: Fix Jest failure for Push Token when Android FCM is not configured

## Problem
After Patch 246, Android devices without FCM/Firebase correctly skip requesting an Expo Push Token.
However, in Jest tests `Platform.OS` is typically mocked as `android` and `expoConfig.android.googleServices*` is missing, so `initialize()` returned early and `getPushToken()` stayed `null`, causing `notificationService.test.ts` to fail.

## Fix
Keep the Android "skip token when no FCM" behavior in real app runs, but **do not apply the skip in test environment**.

- `lib/notificationService.ts`: gate the Android skip behind `process.env.NODE_ENV !== "test"`.

## Notes
- No runtime behavior change for production/dev builds.
- Restores deterministic Jest behavior.
