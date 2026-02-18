# Patch 99 Notes

## What broke
Patch 98 introduced stricter Supabase Edge error sanitization + tests, but:
- `sanitizeUnknownForTransport()` used `const t = typeof v;` which **does not narrow** `v` in TypeScript, causing `tsc` errors.
- The sanitizer used multiple markers (`[REDACTED]`, `[GITHUB_TOKEN_REDACTED]`, etc.) while tests expect a single stable marker: `[REDACTED_TOKEN]`.

## Fix
- Rewrote the type guards in `sanitizeUnknownForTransport()` to use direct `typeof v === ...` checks (and handle `undefined` -> `null`).
- Standardized all token-like redactions to `"[REDACTED_TOKEN]"`.
- Updated docs to reflect Patch 98/99 status.

## Files touched
- `supabase/functions/_shared/errorSanitization.ts`
- `docs/TODO.md`
- `PROJECT_CHECKLOG.md`
- `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`
- `docs/reviews/TERMINAL_SCREEN_VERIFICATION.md`
