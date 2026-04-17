-- Patch 735: low-risk follow-up hardening for trigger/hook search_path contracts.
--
-- Scope:
-- - Re-assert explicit search_path for trigger/helper functions that are expected
--   to stay search_path-locked independent of historical migration ordering.
-- - No behavior refactor, no privilege model change.

DO $$
BEGIN
  IF to_regprocedure('public._diagnostic_upload_guard()') IS NOT NULL THEN
    EXECUTE 'alter function public._diagnostic_upload_guard() set search_path = public, pg_temp';
  END IF;

  IF to_regprocedure('public.cleanup_expired_previews()') IS NOT NULL THEN
    EXECUTE 'alter function public.cleanup_expired_previews() set search_path = public, pg_temp';
  END IF;
END
$$;
