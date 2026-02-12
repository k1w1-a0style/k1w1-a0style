-- supabase/migrations/20260212000000_build_jobs_rls_hardening.sql
-- Hardening: prevent public read access to build_jobs.
--
-- Why:
-- - The original migration created a policy that allowed anon users to read ALL build_jobs rows.
-- - build_jobs can contain sensitive repo names, URLs, and error messages.

-- Ensure RLS stays enabled
alter table public.build_jobs enable row level security;

-- Remove the old public policy (if present)
drop policy if exists "Public read build_jobs" on public.build_jobs;

-- Revoke table privileges for anon/authenticated (defense-in-depth)
revoke all on table public.build_jobs from anon;
revoke all on table public.build_jobs from authenticated;

-- Optional explicit deny policy for clarity (RLS would deny without any select policy)
drop policy if exists "Deny read build_jobs" on public.build_jobs;
create policy "Deny read build_jobs"
  on public.build_jobs
  for select
  to anon, authenticated
  using (false);

-- Service role keeps full access
grant all on table public.build_jobs to service_role;
