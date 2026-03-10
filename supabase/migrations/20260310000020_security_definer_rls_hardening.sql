-- 2026-03-10
-- Patch 412: RLS / policy / privileged-function hardening sweep.
-- Goal:
-- - lock security-definer helper functions to an explicit search_path
-- - revoke accidental PUBLIC execute privileges from privileged functions
-- - keep runtime behavior intact for authenticated diagnostics + service-role CI paths

begin;

-- _diagnostic_upload_guard is a security-definer trigger helper and should not inherit
-- the caller search_path. Recreate it with an explicit search_path and no public execute.
create or replace function public._diagnostic_upload_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  per_hour integer;
  per_day integer;
  max_hour integer := 10;
  max_day integer := 50;
  max_notes integer := 2000;
  max_snapshots_bytes integer := 150000;
  snap_text text;
begin
  if new.device_id is null or length(new.device_id) < 8 then
    raise exception 'device_id missing/invalid';
  end if;

  if new.notes is not null and length(new.notes) > max_notes then
    new.notes := left(new.notes, max_notes) || '…';
  end if;

  begin
    new.ip := inet_client_addr();
  exception when others then
    null;
  end;

  select count(*) into per_hour
  from public.diagnostic_uploads
  where device_id = new.device_id
    and created_at > now() - interval '1 hour';

  if per_hour >= max_hour then
    raise exception 'rate limit exceeded (per hour)';
  end if;

  select count(*) into per_day
  from public.diagnostic_uploads
  where device_id = new.device_id
    and created_at > now() - interval '24 hours';

  if per_day >= max_day then
    raise exception 'rate limit exceeded (per day)';
  end if;

  snap_text := coalesce(new.snapshots::text, '');
  if octet_length(snap_text) > max_snapshots_bytes then
    raise exception 'payload too large';
  end if;

  return new;
end;
$$;

revoke all on function public._diagnostic_upload_guard() from public;
revoke all on function public._diagnostic_upload_guard() from anon;
revoke all on function public._diagnostic_upload_guard() from authenticated;

-- cleanup_expired_previews should stay CI/service-role only.
revoke all on function public.cleanup_expired_previews() from public;
revoke all on function public.cleanup_expired_previews() from anon;
revoke all on function public.cleanup_expired_previews() from authenticated;
grant execute on function public.cleanup_expired_previews() to service_role;

-- insert_diagnostic_upload(jsonb) is intentionally callable by authenticated users and
-- service_role, but not by PUBLIC/anon.
revoke all on function public.insert_diagnostic_upload(jsonb) from public;
revoke all on function public.insert_diagnostic_upload(jsonb) from anon;
revoke all on function public.insert_diagnostic_upload(jsonb) from authenticated;
grant execute on function public.insert_diagnostic_upload(jsonb) to authenticated;
grant execute on function public.insert_diagnostic_upload(jsonb) to service_role;

commit;
