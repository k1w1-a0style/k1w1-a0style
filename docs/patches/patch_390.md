# Patch 390 - edge-function helper visibility/reexports + regression tests

## Goal
Repair the refactored Supabase Edge Functions whose `index.ts` files still use shared symbols
that are no longer directly visible after the `helpers.ts` extraction.

## Fixed functions
- `supabase/functions/k1w1-handler`
- `supabase/functions/android-keystore-export`
- `supabase/functions/android-keystore-generate`
- `supabase/functions/create_codesandbox`

## What changed
- re-export required shared helpers from the affected `helpers.ts` files
- import the now-visible symbols explicitly from `./helpers.ts` in each `index.ts`
- add a regression test `__tests__/edgeHelperVisibility.invariants.test.ts`

## Why it matters
Without these explicit reexports/imports, the refactored `index.ts` files can reference shared helpers
that are not actually visible in module scope, which is a real production risk for Edge deployment.
