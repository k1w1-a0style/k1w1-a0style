# Patch 347: Supabase function bundling import fixes

## Summary
Fixes Supabase Functions deploy failures caused by local `./helpers` imports being resolved without an explicit file extension during bundling.

## Why
`supabase functions deploy` can fail with `Failed to bundle the function` / `Module not found ".../helpers"` when a function imports a local helper file as `./helpers` instead of `./helpers.ts`.

## Changes
- Updated the following functions to import helpers with an explicit `.ts` extension:
  - `android-keystore-export`
  - `android-keystore-generate`
  - `create_codesandbox`
  - `github-workflow-logs`
  - `k1w1-handler`
  - `preview_page`
  - `save_preview`

## Verification
- Run `supabase functions deploy` (or deploy the specific functions) and confirm bundling succeeds.
