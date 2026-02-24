# Patch 261: Edge Function contract tests

Adds Jest contract tests for the Supabase Edge Function request validation layer.

## Why

The app depends on stable request schemas between the client and edge functions.
These tests lock in:

- accepted alias keys (e.g. `github_repo`, `workflowId`, `build_profile`)
- default behaviors (e.g. `ref` defaults to `main`)
- safety rules (e.g. rejecting `refs/*` and 40-char SHAs)

## What changed

- Added `__tests__/edgeFunctionContracts.test.ts`
- Updated `docs/patches/PATCHLOG_ROOT.md`
