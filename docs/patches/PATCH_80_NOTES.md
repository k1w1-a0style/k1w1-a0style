# PATCH 80 – Jest Open Handles / Worker Exit Warning (ChatScreen)

Date: 2026-02-12

## Problem
Jest printed a warning after tests:

> A worker process has failed to exit gracefully... Active timers can also cause this, ensure that .unref() was called on them.

This indicates that at least one test left pending timers/handles alive long enough that the Jest worker had to be force-exited.

## Root cause
`ChatScreen`'s `useChatScreen` hook schedules several fire-and-forget `setTimeout` calls (scroll retry / initial scroll helpers). These timers are short-lived in the app, but during unit tests the suite can finish before they fire, leaving pending timers at shutdown.

## Fix
- Introduced `scheduleTimeout()` helper in `useChatScreen`:
  - Tracks timer IDs
  - Calls `.unref()` in Node/Jest (best effort) so timers do not keep the event loop alive
  - Clears tracked timers on unmount (defense-in-depth)

## Expected UI impact
None. This is internal cleanup only; no layout/styling changes.

## Verification
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent` (warning should disappear)
