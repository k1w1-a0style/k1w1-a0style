-- Compatibility migration: ensure insert_diagnostic_upload(jsonb) returns uuid.
-- After 20260203000000 this should already be true; this runs as a guarded no-op if so.

do $mig$
declare
  fn oid;
  ret regtype;
begin
  fn := to_regprocedure('public.insert_diagnostic_upload(jsonb)');
  if fn is null then
    return;
  end if;

  select prorettype::regtype into ret from pg_proc where oid = fn;
  if ret = 'uuid'::regtype then
    return;
  end if;

  -- If the return type differs, drop + recreate as uuid-returning function.
  execute 'drop function public.insert_diagnostic_upload(jsonb)';

  execute $fn$
  create function public.insert_diagnostic_upload(payload jsonb)
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
    v_client_request_id := nullif(payload->>'client_request_id','')::uuid;

    v_report := coalesce(payload->'report', '{}'::jsonb);
    v_meta   := coalesce(payload->'meta', '{}'::jsonb);

    if v_device_id is null or v_client_request_id is null then
      raise exception 'missing device_id or client_request_id';
    end if;

    insert into public.diagnostic_uploads (
      device_id, client_request_id, repo, branch, mode, platform, report, meta
    )
    values (
      v_device_id, v_client_request_id, v_repo, v_branch, v_mode, v_platform, v_report, v_meta
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
  $fn$;

  execute 'revoke execute on function public.insert_diagnostic_upload(jsonb) from anon, authenticated';
end $mig$;
