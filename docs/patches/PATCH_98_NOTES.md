# PATCH 98 NOTES

Date: 2026-02-13

## Summary

Supabase hardening follow-up:

- RLS/Policy audit tightening for diagnostics tables + signing storage bucket.
- Ensure all Edge **error** responses sanitize token/key patterns.
- Add a short runbook for deploy + migrations.
- Add Jest unit tests for the sanitizer.

## Changes

### Database
- New migration: `supabase/migrations/20260213000000_rls_audit_hardening.sql`
  - Deny SELECT for `diagnostics_reports` and `diagnostic_uploads` for `anon` + `authenticated`.
  - Add explicit deny policies for `storage.objects` where `bucket_id = 'signing'`.

### Edge Functions
- `supabase/functions/_shared/cors.ts`: `errorResponse()` now sanitizes the `error` string and `details` payload.
- `supabase/functions/_shared/errorSanitization.ts`: add `sanitizeUnknownForTransport()` for safe deep sanitization.
- `supabase/functions/create_codesandbox`: sanitize error payloads and logs.
- `supabase/functions/save_preview`: sanitize error logs.

### Tests
- `__tests__/supabaseErrorSanitization.test.ts`

### Docs
- `docs/runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md`
- Update `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`
- Update `docs/TODO.md` + `PROJECT_CHECKLOG.md`

## Deploy / Ops Notes

After applying this patch:

1) Deploy functions (if changed): `supabase functions deploy`
2) Apply migrations: `supabase db push`

See: `docs/runbooks/SUPABASE_DEPLOY_AND_MIGRATIONS.md`