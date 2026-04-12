-- Narrow RLS deny semantics for signing_android and re-assert secure search_path
-- on security definer RPC functions that are part of the active edge/auth contract.

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'signing_android'
      and policyname = 'signing_android_deny_all'
  ) then
    execute 'drop policy signing_android_deny_all on public.signing_android';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'signing_android'
      and policyname = 'signing_android_deny_anon_authenticated'
  ) then
    create policy signing_android_deny_anon_authenticated on public.signing_android
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.enforce_edge_rate_limit(text,text,integer,integer)') is not null then
    execute 'alter function public.enforce_edge_rate_limit(text,text,integer,integer) set search_path = public, pg_temp';
  end if;

  if to_regprocedure('public.insert_diagnostic_upload(jsonb)') is not null then
    execute 'alter function public.insert_diagnostic_upload(jsonb) set search_path = public, pg_temp';
  end if;
end $$;
