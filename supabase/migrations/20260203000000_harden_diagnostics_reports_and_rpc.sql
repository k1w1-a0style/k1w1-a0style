begin;

-- 1) Fix idempotency for public.insert_diagnostic_upload(payload jsonb)
-- Ensure retries with same (device_id, client_request_id) stay idempotent.

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
  v_client_request_id uuid;
  v_id bigint;
  v_payload_size int;
begin
  if payload is null then
    raise exception 'payload is required';
  end if;

  v_payload_size := octet_length(payload::text);
  if v_payload_size > 200000 then
    raise exception 'payload too large';
  end if;

  v_device_id := nullif(btrim(payload->>'device_id'), '');
  if v_device_id is null then
    raise exception 'device_id is required';
  end if;

  v_client_request_id := nullif(btrim(payload->>'client_request_id'), '')::uuid;
  if v_client_request_id is null then
    raise exception 'client_request_id is required';
  end if;

  v_target := nullif(btrim(payload->>'target'), '');
  v_app_version := nullif(btrim(payload->>'app_version'), '');
  v_project_name := nullif(btrim(payload->>'project_name'), '');
  v_notes := nullif(payload->>'notes', '');
  v_ip := nullif(payload->>'ip', '')::inet;

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
  do update set
    app_version = excluded.app_version,
    project_name = excluded.project_name,
    target = excluded.target,
    summary = excluded.summary,
    snapshots = excluded.snapshots,
    notes = excluded.notes,
    ip = excluded.ip
  returning id into v_id;

  return v_id;
end $$;

-- Drop legacy overload (dead code + extra attack surface)
drop function if exists public.insert_diagnostic_upload(
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  uuid
);

revoke execute on function public.insert_diagnostic_upload(
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text,
  uuid
) from anon, authenticated;

-- 2) Harden diagnostics_reports RLS: remove anon world-readable access
drop policy if exists "Public read diagnostics_reports" on public.diagnostics_reports;

create policy "Authenticated read diagnostics_reports"
on public.diagnostics_reports
for select
to authenticated
using (true);

revoke select on table public.diagnostics_reports from anon;
grant select on table public.diagnostics_reports to authenticated;

commit;
