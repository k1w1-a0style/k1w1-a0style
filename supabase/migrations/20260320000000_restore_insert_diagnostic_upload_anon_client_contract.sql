begin;

-- Final auth contract for diagnostics uploads:
-- The mobile app calls public.insert_diagnostic_upload(jsonb) directly via the normal
-- Supabase client (anon key / client session). The RPC stays SECURITY DEFINER and keeps
-- payload validation, idempotency and rate limits on the server side.
revoke all on function public.insert_diagnostic_upload(jsonb) from public;
revoke all on function public.insert_diagnostic_upload(jsonb) from anon;
revoke all on function public.insert_diagnostic_upload(jsonb) from authenticated;

grant execute on function public.insert_diagnostic_upload(jsonb) to anon;
grant execute on function public.insert_diagnostic_upload(jsonb) to authenticated;
grant execute on function public.insert_diagnostic_upload(jsonb) to service_role;

comment on function public.insert_diagnostic_upload(jsonb) is
  'Client diagnostics upload RPC; callable by anon/authenticated/service_role with SQL-side rate and payload guards.';

commit;
