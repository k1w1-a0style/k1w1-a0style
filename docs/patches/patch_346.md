# Patch 346: Fix Supabase github-workflow-logs bundling (helpers import)

## Summary
Fixes Supabase Functions deploy failing with `Module not found ... github-workflow-logs/helpers` by using an explicit `.ts` extension in the helper import.

## Changes
- `supabase/functions/github-workflow-logs/index.ts`
  - Change `./helpers` import to `./helpers.ts` for Supabase bundler compatibility.

## Verification
- Run: `supabase functions deploy` (or deploy `github-workflow-logs`)
- Expect: bundling succeeds (no module not found error).
