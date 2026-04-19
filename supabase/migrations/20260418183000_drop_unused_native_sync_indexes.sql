-- Remove legacy native-sync indexes that are currently unused.
-- The native-sync edge flows are removed from the repo and the backing tables are empty,
-- so these indexes add write/storage overhead without serving active queries.

drop index if exists public.native_sync_jobs_repo_idx;
drop index if exists public.native_sync_jobs_status_idx;
drop index if exists public.native_sync_reports_job_id_idx;