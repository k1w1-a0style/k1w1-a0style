# Patch 252: Stabilize push token retrieval in test/non-Expo environments

## Changes
- **Fix:** `NotificationService.initialize()` no longer throws when `expo-constants` is missing or incomplete.
- **Test stability:** If no `projectId` is available, `getExpoPushTokenAsync()` is called without options (works with Jest mocks).
- **Keeps behavior:** Android without FCM still skips token retrieval **outside** Jest.

## Files
- `lib/notificationService.ts`
- `docs/patches/patch_252.md`
- `docs/patches/PATCHLOG_ROOT.md`
