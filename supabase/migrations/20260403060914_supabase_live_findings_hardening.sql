-- Patch 734 (repo-only): prepare hardening for confirmed live Supabase findings.
-- IMPORTANT: this migration is intentionally idempotent and safe to apply in environments
-- where parts of the contract are already hardened.

begin;

-- ---------------------------------------------------------------------------
-- A) build_jobs RLS public-read gap
-- ---------------------------------------------------------------------------
-- Repo status: already hardened in 20260212000000_build_jobs_rls_hardening.sql.
-- Keep a minimal re-assertion here so environments with partial/manual drift converge.
alter table if exists public.build_jobs enable row level security;
drop policy if exists "Public read build_jobs" on public.build_jobs;
drop policy if exists "build_jobs_public_read" on public.build_jobs;
revoke all on table public.build_jobs from anon;
revoke all on table public.build_jobs from authenticated;

drop policy if exists "Deny read build_jobs" on public.build_jobs;
create policy "Deny read build_jobs"
  on public.build_jobs
  for select
  to anon, authenticated
  using (false);

grant all on table public.build_jobs to service_role;

-- ---------------------------------------------------------------------------
-- B) cleanup_old_previews(integer) privilege/search_path hardening
-- ---------------------------------------------------------------------------
-- Legacy live finding: security-definer function callable by PUBLIC.
-- We only harden privileges/search_path if that legacy signature exists.
do $$
declare
  legacy_cleanup regprocedure;
begin
  legacy_cleanup := to_regprocedure('public.cleanup_old_previews(integer)');

  if legacy_cleanup is not null then
    execute 'alter function public.cleanup_old_previews(integer) set search_path = public, pg_temp';
    execute 'revoke all on function public.cleanup_old_previews(integer) from public';
    execute 'revoke all on function public.cleanup_old_previews(integer) from anon';
    execute 'revoke all on function public.cleanup_old_previews(integer) from authenticated';
    execute 'grant execute on function public.cleanup_old_previews(integer) to service_role';
  else
    raise notice 'public.cleanup_old_previews(integer) not present; skipping legacy cleanup hardening';
  end if;
end
$$;

-- Also keep the current canonical cleanup helper locked to an explicit search_path.
do $$
begin
  if to_regprocedure('public.cleanup_expired_previews()') is not null then
    execute 'alter function public.cleanup_expired_previews() set search_path = public, pg_temp';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- C) signing_audit_log explicit deny policies
-- ---------------------------------------------------------------------------
-- Security intent: no direct anon/authenticated reads or writes.
alter table if exists public.signing_audit_log enable row level security;

revoke all on table public.signing_audit_log from anon;
revoke all on table public.signing_audit_log from authenticated;
grant all on table public.signing_audit_log to service_role;

drop policy if exists "Deny read signing_audit_log" on public.signing_audit_log;
create policy "Deny read signing_audit_log"
  on public.signing_audit_log
  for select
  to anon, authenticated
  using (false);

drop policy if exists "Deny write signing_audit_log" on public.signing_audit_log;
create policy "Deny write signing_audit_log"
  on public.signing_audit_log
  for all
  to anon, authenticated
  using (false)
  with check (false);

commit;
