# Patch 249: Fix Jest push token expectation under Android without FCM

## Problem
Unit tests expect `NotificationService.initialize()` to populate an Expo push token.  
On Android without configured `googleServicesFile/googleServicesPath`, the service intentionally skips fetching a push token to avoid Firebase initialization warnings.  
In Jest runs, this skip could still trigger depending on environment variables, causing `getPushToken()` to return `null` and the test to fail.

## Fix
Treat Jest runs as a test environment using `process.env.JEST_WORKER_ID` (and `NODE_ENV === "test"`), and **do not** skip push-token fetching in that case.  
Runtime behavior remains unchanged: Android without FCM still skips push-token fetching outside of tests.
