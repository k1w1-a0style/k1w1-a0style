#!/usr/bin/env bash
set -euo pipefail

MIGRATION="supabase/migrations/20260310000020_security_definer_rls_hardening.sql"

if [ ! -f "$MIGRATION" ]; then
  echo "Missing migration: $MIGRATION" >&2
  exit 1
fi

grep -Fq 'create or replace function public._diagnostic_upload_guard()' "$MIGRATION"
grep -Fq 'security definer' "$MIGRATION"
grep -Fq 'set search_path = public, pg_temp' "$MIGRATION"
grep -Fq 'revoke all on function public._diagnostic_upload_guard() from public;' "$MIGRATION"
grep -Fq 'revoke all on function public.cleanup_expired_previews() from public;' "$MIGRATION"
grep -Fq 'grant execute on function public.cleanup_expired_previews() to service_role;' "$MIGRATION"
grep -Fq 'revoke all on function public.insert_diagnostic_upload(jsonb) from public;' "$MIGRATION"
grep -Fq 'grant execute on function public.insert_diagnostic_upload(jsonb) to authenticated;' "$MIGRATION"
grep -Fq 'grant execute on function public.insert_diagnostic_upload(jsonb) to service_role;' "$MIGRATION"

echo "Supabase RLS hardening invariants OK"
