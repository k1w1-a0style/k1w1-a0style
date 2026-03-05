# Patch 348: Fix Supabase preview_page bundling (nested template literal)

## Problem
`supabase functions deploy` failed while bundling `preview_page` with a parse error around a `$` token.
Root cause: `preview_page/index.ts` returns an HTML template literal using backticks, but the embedded `<script>` used a JS template literal (also backticks) without escaping, prematurely terminating the outer template string.

## Fix
- Replaced the inner JS template literal in the raw logs appender with string concatenation to avoid unescaped backticks inside the outer HTML template literal.

## Impact
- `preview_page` bundles and deploys cleanly.
- No functional change beyond stabilizing the raw logs rendering.

## Files
- `supabase/functions/preview_page/index.ts`
