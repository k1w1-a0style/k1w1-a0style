# Patch 265: Fix `Deno is not defined` in local tests/typecheck for Edge CORS helpers

**Date:** 2026-02-24

## Problem
`supabase/functions/_shared/cors.ts` referenced `Deno.env.get(...)` directly.
This works in Supabase Edge (Deno) but breaks local `jest` and repo `tsc`:
- `ReferenceError: Deno is not defined` in tests
- `TS2304: Cannot find name 'Deno'` in typecheck

## Fix
- Added `getRuntimeEnv()` helper using `globalThis.Deno?.env?.get()` with Node fallback to `process.env`.
- Replaced direct `Deno.env.get("ENVIRONMENT")` usage with `getRuntimeEnv("ENVIRONMENT")`.

## Result
- `npm run test:silent` works in Node/Jest
- `npm run typecheck` passes
- Edge behavior remains unchanged in production.
