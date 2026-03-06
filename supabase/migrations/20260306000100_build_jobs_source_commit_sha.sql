-- Patch 384: persist the exact checked-out commit SHA for build_jobs.
-- This hardens the build pipeline against branch drift by binding a build job
-- to the concrete commit that GitHub Actions actually checked out.

alter table public.build_jobs
  add column if not exists source_commit_sha text;

create index if not exists build_jobs_source_commit_sha_idx
  on public.build_jobs (source_commit_sha);
