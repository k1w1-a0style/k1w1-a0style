-- Adds artifact metadata to build_jobs so the client can show artifact links reliably.
-- Safe to apply multiple times.

alter table public.build_jobs
  add column if not exists download_url text,
  add column if not exists artifact_name text,
  add column if not exists artifact_sha256 text,
  add column if not exists artifact_size bigint;
