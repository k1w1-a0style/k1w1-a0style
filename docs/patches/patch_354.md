# Patch 354: Fix github-workflow-logs Edge 500 (missing shared imports)

## Problem
The Supabase Edge Function `github-workflow-logs` deployed but returned **500 Internal Server Error** at runtime.
Root cause: `index.ts` referenced shared helpers (`handleCors`, `requireAdminKey`, `rateLimit`, `parseJsonBody`) that were **not imported**
after a refactor. This caused a runtime `ReferenceError` before the function logic executed.

## Fix
- Added explicit imports from `../_shared/*` in `supabase/functions/github-workflow-logs/index.ts`
- Tightened the catch type to `catch (e: unknown)` (no runtime change, just safer typing)

## Files
- `supabase/functions/github-workflow-logs/index.ts`
