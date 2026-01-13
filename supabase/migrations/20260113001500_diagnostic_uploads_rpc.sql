-- Diagnostics uploads: RPC insert that returns real DB id while keeping anon SELECT disabled.
-- This hardens uploads: direct INSERT can be revoked, and server-side rate limiting is enforced.
--
-- Expected table: public.diagnostic_uploads
-- Columns used: device_id (text), app_version (text), project_name (text), target (text),
-- summary (jsonb), snapshots (jsonb), notes (text), ip (inet), created_at (timestamptz)

begin;

-- Ensure column `ip` exists (older schemas might not have it yet).
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'diagnostic_uploads'
      and column_name = 'ip'
  ) then
    alter table public.diagnostic_uploads add column ip inet;
  end if;
end $$;

-- Harden table privileges: prevent direct INSERT from anon/authenticated.
-- (RPC remains available for anon/authenticated and returns the id.)
revoke insert on table public.diagnostic_uploads from anon, authenticated;

-- Drop the old anon insert policy if present (we don't want REST INSERTs).
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'diagnostic_uploads'
      and policyname = 'diagnostic_uploads_insert_anon'
  ) then
    drop policy diagnostic_uploads_insert_anon on public.diagnostic_uploads;
  end if;
end $$;

-- SECURITY DEFINER RPC for inserting a diagnostic upload and returning the real DB id.
-- Server-side rate limiting: per IP and per device_id.
create or replace function public.insert_diagnostic_upload(payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id text;
  v_target text;
  v_app_version text;
  v_project_name text;
  v_notes text;
  v_ip inet;
  v_id bigint;
  v_payload_size int;
  v_recent_ip int;
  v_recent_device int;
begin
  -- Basic payload sanity
  if payload is null then
    raise exception 'payload is required';
  end if;

  v_payload_size := octet_length(payload::text);
  if v_payload_size > 200000 then
    raise exception 'payload too large';
  end if;

  v_device_id := nullif(btrim(payload->>'device_id'), '');
  if v_device_id is null or length(v_device_id) > 200 then
    raise exception 'invalid device_id';
  end if;

  v_target := nullif(btrim(payload->>'target'), '');
  if v_target is null or length(v_target) > 80 then
    raise exception 'invalid target';
  end if;

  v_app_version := nullif(btrim(payload->>'app_version'), '');
  if v_app_version is not null and length(v_app_version) > 60 then
    raise exception 'invalid app_version';
  end if;

  v_project_name := nullif(btrim(payload->>'project_name'), '');
  if v_project_name is not null and length(v_project_name) > 120 then
    raise exception 'invalid project_name';
  end if;

  v_notes := payload->>'notes';
  if v_notes is not null and length(v_notes) > 4000 then
    raise exception 'notes too long';
  end if;

  v_ip := coalesce(inet_client_addr(), '0.0.0.0'::inet);

  -- Rate limiting (server-side). Tune as needed.
  -- Per-IP: max 12 inserts per minute.
  select count(*) into v_recent_ip
  from public.diagnostic_uploads
  where ip = v_ip and created_at > (now() - interval '1 minute');

  if v_recent_ip >= 12 then
    raise exception 'rate limit exceeded (ip)';
  end if;

  -- Per device: max 6 inserts per 10 minutes.
  select count(*) into v_recent_device
  from public.diagnostic_uploads
  where device_id = v_device_id and created_at > (now() - interval '10 minutes');

  if v_recent_device >= 6 then
    raise exception 'rate limit exceeded (device)';
  end if;

  insert into public.diagnostic_uploads (
    device_id,
    app_version,
    project_name,
    target,
    summary,
    snapshots,
    notes,
    ip
  )
  values (
    v_device_id,
    v_app_version,
    v_project_name,
    v_target,
    payload->'summary',
    payload->'snapshots',
    v_notes,
    v_ip
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Allow anon/authenticated to call the RPC.
grant execute on function public.insert_diagnostic_upload(jsonb) to anon, authenticated;

commit;
