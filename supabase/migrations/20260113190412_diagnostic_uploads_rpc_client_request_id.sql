begin;

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Ensure column exists
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'diagnostic_uploads'
      and column_name = 'client_request_id'
  ) then
    alter table public.diagnostic_uploads
      add column client_request_id uuid;
  end if;
end $$;

-- Backfill NULLs (for old rows)
update public.diagnostic_uploads
set client_request_id = gen_random_uuid()
where client_request_id is null;

-- Ensure default + not null
alter table public.diagnostic_uploads
  alter column client_request_id set default gen_random_uuid();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='diagnostic_uploads'
      and column_name='client_request_id'
      and is_nullable='YES'
  ) then
    alter table public.diagnostic_uploads
      alter column client_request_id set not null;
  end if;
end $$;

-- Idempotency key (per device + request)
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='diagnostic_uploads'
      and indexname='diagnostic_uploads_device_client_request_uidx'
  ) then
    create unique index diagnostic_uploads_device_client_request_uidx
      on public.diagnostic_uploads (device_id, client_request_id);
  end if;
end $$;

-- Replace RPC to include client_request_id and be idempotent
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
  v_client_request_id uuid;
begin
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

  -- client_request_id: optional in payload, generated if missing/invalid
  begin
    v_client_request_id := nullif(btrim(payload->>'client_request_id'), '')::uuid;
  exception when others then
    v_client_request_id := null;
  end;

  if v_client_request_id is null then
    v_client_request_id := gen_random_uuid();
  end if;

  v_ip := coalesce(inet_client_addr(), '0.0.0.0'::inet);

  -- Rate limiting:
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
    client_request_id,
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
    v_client_request_id,
    v_app_version,
    v_project_name,
    v_target,
    payload->'summary',
    payload->'snapshots',
    v_notes,
    v_ip
  )
  on conflict (device_id, client_request_id)
  do update set project_name = public.diagnostic_uploads.project_name
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_diagnostic_upload(jsonb) from public;
grant execute on function public.insert_diagnostic_upload(jsonb) to anon, authenticated;

commit;
