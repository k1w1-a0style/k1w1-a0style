# Patch 251: fix jest push token skip detection

## Summary
- Fixes the Android “skip push token when FCM not configured” guard so it does **not** trigger during Jest tests.

## Details
`NotificationService.initialize()` skipped `getExpoPushTokenAsync()` on Android when `googleServicesFile/path` was missing, unless `NODE_ENV === "test"`. In this project’s Jest runs, `NODE_ENV` is not reliably set to `"test"`, causing the service to skip token retrieval and leaving `expoPushToken` null, which broke `notificationService.getPushToken()` tests.

This patch detects Jest via `process.env.JEST_WORKER_ID` and only applies the Android skip outside Jest.
