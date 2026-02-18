# Patch 87 Notes

## Ziel
Security-Hardening für Supabase + Edge Functions (ohne UI-Änderungen).

## Änderungen

### Supabase Client Init
- Entfernt sensitive `console.log`s in `lib/supabase.ts` (keine URL/Key Präsenz/URL-Teile mehr in Logs).

### RLS / Migration
- Neue Migration: `20260212000000_build_jobs_rls_hardening.sql`
  - Drop `Public read build_jobs`
  - Revoke `anon/authenticated`
  - Deny-Policy für Select (defense-in-depth)

### Edge Functions
- Neues Shared Modul: `supabase/functions/_shared/errorSanitization.ts`
- GitHub/EAS error responses werden sanitisiert:
  - keine raw bodies/URLs
  - redaction: Bearer, JWT, GitHub tokens + long-secret heuristic

## UI/Optik
Keine Änderungen.

## Verification
Siehe `docs/reviews/SUPABASE_MIGRATION_VERIFICATION.md`.