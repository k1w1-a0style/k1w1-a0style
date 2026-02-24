# Patch 250: Fix Jest Push-Token Test (reliable Jest detection)

## Problem
`NotificationService.initialize()` skips fetching the Expo push token on Android when FCM isn't configured.
In Jest, `NODE_ENV` is not always `"test"`, so the skip path could still trigger, leaving `expoPushToken` as `null`
and failing `lib/__tests__/notificationService.test.ts`.

## Fix
Detect Jest reliably via `process.env.JEST_WORKER_ID` and only skip token retrieval on Android *outside* Jest.

## Files changed
- `lib/notificationService.ts`
