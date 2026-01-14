-- Adds client_request_id + RPC insert that returns DB id without granting anon SELECT.
-- Safe pattern: keep RLS tight, allow anon EXECUTE on security definer function.

create extension if not exists pgcrypto;

alter table if exists public.diagnostic_uploads
  add column if not exists client_request_id uuid;

-- backfill for existing rows
update public.diagnostic_uploads
set client_request_id = gen_random_uuid()
where client_request_id is null;

alter table public.diagnostic_uploads
  alter column client_request_id set not null;

create unique index if not exists diagnostic_uploads_client_request_id_ux
  on public.diagnostic_uploads (client_request_id);

create or replace function public.insert_diagnostic_upload(
  p_device_id text,
  p_app_version text,
  p_project_name text,
  p_target text,
  p_summary jsonb,
  p_snapshots jsonb,
  p_notes text,
  p_client_request_id uuid
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_req uuid;
begin
  -- minimal validation (keep conservative, your client already sanitizes)
  if p_device_id is null or length(p_device_id) < 3 or length(p_device_id) > 200 then
    raise exception 'invalid device_id';
  end if;

  if p_notes is not null and length(p_notes) > 5000 then
    raise exception 'notes too long';
  end if;

  if p_summary is not null and pg_column_size(p_summary) > 200000 then
    raise exception 'summary too large';
  end if;

  if p_snapshots is not null and pg_column_size(p_snapshots) > 2000000 then
    raise exception 'snapshots too large';
  end if;

  v_req := coalesce(p_client_request_id, gen_random_uuid());

  insert into public.diagnostic_uploads(
    device_id,
    app_version,
    project_name,
    target,
    summary,
    snapshots,
    notes,
    ip,
    client_request_id
  )
  values(
    p_device_id,
    nullif(p_app_version, ''),
    nullif(p_project_name, ''),
    nullif(p_target, ''),
    p_summary,
    p_snapshots,
    p_notes,
    inet_client_addr(),
    v_req
  )
  on conflict (client_request_id) do update set
    device_id = excluded.device_id,
    app_version = excluded.app_version,
    project_name = excluded.project_name,
    target = excluded.target,
    summary = excluded.summary,
    snapshots = excluded.snapshots,
    notes = excluded.notes,
    ip = excluded.ip
  returning id into v_id;

  return v_id;
end;
$$;

-- tighten function privileges
revoke all on function public.insert_diagnostic_upload(
  text,text,text,text,jsonb,jsonb,text,uuid
) from public;

grant execute on function public.insert_diagnostic_upload(
  text,text,text,text,jsonb,jsonb,text,uuid
) to anon, authenticated;
