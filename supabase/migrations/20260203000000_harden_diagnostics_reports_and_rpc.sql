-- Harden diagnostics_reports access + restore diagnostics upload RPC idempotency (safe + idempotent)
-- NOTE: This migration intentionally guards legacy function revoke/grants because some projects
-- never had the legacy signature deployed.

begin;

-- ----------------------------
-- diagnostics_reports: remove anon access, allow authenticated read
-- ----------------------------
do $$
begin
  if to_regclass('public.diagnostics_reports') is not null then
    execute 'alter table public.diagnostics_reports enable row level security';
    -- Remove broad grants (keep it explicit)
    execute 'revoke all on table public.diagnostics_reports from anon, authenticated';
    execute 'grant select on table public.diagnostics_reports to authenticated';

    -- Drop existing select policies (if any) so we can re-create deterministically
    -- (PG15 has no CREATE POLICY IF NOT EXISTS)
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename  = 'diagnostics_reports'
        and policyname = 'diagnostics_reports_read_authenticated'
    ) then
      execute 'drop policy diagnostics_reports_read_authenticated on public.diagnostics_reports';
    end if;

    execute $p$
      create policy diagnostics_reports_read_authenticated
      on public.diagnostics_reports
      for select
      to authenticated
      using (true)
    $p$;
  end if;
end $$;

-- ----------------------------
-- diagnostics uploads RPC: drop legacy signature privileges safely
-- ----------------------------
do $$
declare
  legacy regprocedure;
begin
  legacy := to_regprocedure('public.insert_diagnostic_upload(text,text,text,text,jsonb,jsonb,text,uuid)');
  if legacy is not null then
    execute 'revoke execute on function public.insert_diagnostic_upload(text,text,text,text,jsonb,jsonb,text,uuid) from anon, authenticated';
    -- drop legacy to avoid accidental client usage
    execute 'drop function if exists public.insert_diagnostic_upload(text,text,text,text,jsonb,jsonb,text,uuid)';
  end if;
end $$;

-- ----------------------------
-- diagnostics uploads RPC: jsonb payload version (idempotent via ON CONFLICT)
-- expects table public.diagnostic_uploads with unique (device_id, client_request_id)
-- ----------------------------
create or replace function public.insert_diagnostic_upload(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id text;
  v_repo text;
  v_branch text;
  v_mode text;
  v_report jsonb;
  v_meta jsonb;
  v_platform text;
  v_client_request_id uuid;
  v_id uuid;
begin
  v_device_id := nullif(payload->>'device_id','');
  v_repo := nullif(payload->>'repo','');
  v_branch := nullif(payload->>'branch','');
  v_mode := nullif(payload->>'mode','');
  v_platform := nullif(payload->>'platform','');
  v_client_request_id := (payload->>'client_request_id')::uuid;

  v_report := coalesce(payload->'report', '{}'::jsonb);
  v_meta   := coalesce(payload->'meta', '{}'::jsonb);

  if v_device_id is null or v_client_request_id is null then
    raise exception 'missing device_id or client_request_id';
  end if;

  insert into public.diagnostic_uploads (
    device_id,
    client_request_id,
    repo,
    branch,
    mode,
    platform,
    report,
    meta
  )
  values (
    v_device_id,
    v_client_request_id,
    v_repo,
    v_branch,
    v_mode,
    v_platform,
    v_report,
    v_meta
  )
  on conflict (device_id, client_request_id) do update
  set
    repo     = excluded.repo,
    branch   = excluded.branch,
    mode     = excluded.mode,
    platform = excluded.platform,
    report   = excluded.report,
    meta     = excluded.meta
  returning id into v_id;

  return v_id;
end;
$$;

-- Lock down execution: only authenticated + service_role should call it (anon blocked)
revoke execute on function public.insert_diagnostic_upload(jsonb) from anon;
grant  execute on function public.insert_diagnostic_upload(jsonb) to authenticated;

commit;
