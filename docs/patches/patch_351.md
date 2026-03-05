# Patch 351 (2026-03-05): Fix Supabase preview_page bundling (nested template literals)

## Problem
Supabase Functions bundling failed for `preview_page` with a parse error like:
- `Expected ';', got '$'` in `supabase/functions/preview_page/index.ts`

Cause: `preview_page/index.ts` returns an HTML document using a top-level template literal. Inside the embedded `<script>` we used nested template literals (backticks) in `appendLog(...)`, which terminates the outer string early and breaks parsing.

## Fix
- Replaced nested template literals in the embedded script with plain string concatenation:
  - `appendLog(\`...\$Ellipsis...\`)` → `appendLog("..." + ... )`

## Files changed
- `supabase/functions/preview_page/index.ts`

## Verification
- `supabase functions deploy preview_page`
