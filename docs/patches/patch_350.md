# Patch 350: Supabase Edge Functions bundling hardening (helpers import ext + template-literal fix)

## Why
Supabase Edge Function bundling failed in several functions due to:
- Relative imports to `./helpers` without explicit `.ts` extension (bundler failed to resolve / include file).
- A nested template-literal inside the HTML template in `preview_page/index.ts` which prematurely terminated the outer template string, causing a parse error (`Expected ';', got '$'`).
- A duplicate `handleCors()` call pattern (`if (handleCors(req)) return handleCors(req)`) creating multiple Response objects and adding noise to error handling.
- `android-keystore-generate/index.ts` missing its final closing `});` (EOF parse error).

## What changed
### Edge Functions
- Normalize all local helpers imports to `from "./helpers.ts"` in:
  - `android-keystore-generate`
  - `android-keystore-export`
  - `github-workflow-logs`
  - `k1w1-handler`
  - `create_codesandbox`
  - `preview_page`
  - `save_preview`
- Fix `preview_page` client script log prepend to avoid nested backticks (use string concatenation).
- Replace duplicate `handleCors` call with a single-call pattern in:
  - `trigger-eas-build`
  - `github-workflow-runs`
  - `github-workflow-dispatch`
- Close the server handler in `android-keystore-generate/index.ts` to prevent EOF parse errors.

## Verification
- `supabase functions deploy <function>` no longer fails with:
  - `Module not found ".../helpers"`
  - `Expected ';', got '$'`
  - `Unexpected eof`

## Files
- supabase/functions/android-keystore-generate/index.ts
- supabase/functions/android-keystore-export/index.ts
- supabase/functions/github-workflow-logs/index.ts
- supabase/functions/k1w1-handler/index.ts
- supabase/functions/create_codesandbox/index.ts
- supabase/functions/preview_page/index.ts
- supabase/functions/save_preview/index.ts
- supabase/functions/trigger-eas-build/index.ts
- supabase/functions/github-workflow-runs/index.ts
- supabase/functions/github-workflow-dispatch/index.ts
