# Patch 246: Fix GitHub workflow dispatch token + suppress Android FCM push-token fetch when not configured

## Summary

Fixes a runtime crash in the `github-workflow-dispatch` Supabase Edge Function caused by referencing an undefined `githubToken` variable.
Also prevents noisy Android push-token warnings when FCM/Firebase isn't configured by skipping Expo push-token retrieval on Android unless Google Services are present.

## Changes

- `supabase/functions/github-workflow-dispatch/index.ts`
  - Use `getGithubToken()` directly to avoid `ReferenceError: githubToken is not defined`.
- `lib/notificationService.ts`
  - Skip `Notifications.getExpoPushTokenAsync()` on Android when no `googleServicesFile`/`googleServicesPath` is configured.

## Notes

- This patch does **not** require Firebase; Android push-token retrieval is simply skipped unless FCM configuration exists.
- After applying, run:
  - `npm run test:silent`
  - `npm run typecheck`
