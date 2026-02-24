# Patch 254: Harden GitHub workflow dispatch token handling

## Changes
- Prefer server-side GitHub token secret, only falling back to a caller-provided token when no server secret is available.
- Ensure `githubToken` is returned from request validation (for fallback compatibility).
- Harden error sanitization: redact values of common secret-bearing keys (e.g. `*token*`, `*secret*`, `authorization`, `service_role`, `password`) in error details.

## Files
- `supabase/functions/github-workflow-dispatch/index.ts`
- `supabase/functions/_shared/validation.ts`
- `supabase/functions/_shared/errorSanitization.ts`
