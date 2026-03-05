# Patch 352: Fix preview_page bundling (no nested template literals)

## Problem
`supabase functions deploy` failed to bundle `preview_page` due to nested JavaScript template literals (backticks)
inside an outer HTML template literal, causing parse errors like: `Expected ';', got '$'`.

## Fix
- Removed inner template literals in the embedded `<script>` (e.g. `rawLogsEl.textContent = ...` and `appendLog(...)` calls).
- Replaced with safe string concatenation so the outer HTML template remains valid for the Edge bundler.

## Files
- `supabase/functions/preview_page/index.ts`
