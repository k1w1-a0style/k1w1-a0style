-- ============================================================
-- P0 Security Remediation
-- Scope: lint_jobs, native_sync_jobs, native_sync_reports
-- Reason: anon/authenticated had unrestricted table access
-- Date: 2026-03-30
-- Changes:
--   1) lint_jobs: drop faulty public-role policy, add explicit deny
--   2) native_sync_jobs: enable RLS, add explicit deny
--   3) native_sync_reports: enable RLS, add explicit deny
-- No other tables, functions, triggers, or grants touched.
-- ============================================================

-- ── 1) lint_jobs ────────────────────────────────────────────
-- Remove the policy that used roles={public} with USING(true),
-- which granted ALL access to every role including anon/authenticated.
-- The policy was mislabelled "Service role full access" but used
-- the PUBLIC pseudo-role, making it apply to everyone.
DROP POLICY IF EXISTS "Service role full access lint_jobs"
  ON public.lint_jobs;

-- Add explicit fail-closed policy for anon and authenticated.
-- service_role is unaffected (rolbypassrls = true).
DROP POLICY IF EXISTS "deny_anon_authenticated_lint_jobs"
  ON public.lint_jobs;

CREATE POLICY "deny_anon_authenticated_lint_jobs"
  ON public.lint_jobs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ── 2) native_sync_jobs ─────────────────────────────────────
-- RLS was disabled entirely; anon/authenticated had full table access.
ALTER TABLE public.native_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_authenticated_native_sync_jobs"
  ON public.native_sync_jobs;

CREATE POLICY "deny_anon_authenticated_native_sync_jobs"
  ON public.native_sync_jobs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ── 3) native_sync_reports ──────────────────────────────────
-- Same situation as native_sync_jobs.
ALTER TABLE public.native_sync_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_authenticated_native_sync_reports"
  ON public.native_sync_reports;

CREATE POLICY "deny_anon_authenticated_native_sync_reports"
  ON public.native_sync_reports
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
