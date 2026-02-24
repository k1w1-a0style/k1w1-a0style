# Patch 257

## Summary
Adds a regression test to ensure `sanitizeUnknownForTransport()` redacts sensitive keys (e.g., `token`, `authorization`, `api_key`, `serviceRoleKey`, `password`) even when they appear inside **nested arrays**.

## Why
We already harden redaction by key name (Patch 255). This patch makes that guarantee non-regressible for the common "event list" shape where objects are nested inside arrays/arrays-of-arrays.

## Files changed
- `__tests__/supabaseErrorSanitization.test.ts`
- `docs/patches/patch_257.md`
- `docs/patches/PATCHLOG_ROOT.md`
