# Patch 353: Fix preview_page bundling asset graph (helpers import)

## Problem
`supabase functions deploy preview_page` failed to bundle with:
- `Module not found .../preview_page/helpers`

The deploy output showed only `index.ts` being uploaded, meaning the bundler did not include `helpers.ts` in the asset graph.

## Fix
- Updated local imports in `preview_page/index.ts` to reference `./helpers.ts` explicitly, so the Supabase bundler includes the file.

## Files
- `supabase/functions/preview_page/index.ts`
