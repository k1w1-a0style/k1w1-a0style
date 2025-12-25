-- Native Sync Jobs + Reports
-- Safe for first-time migration (creates tables if missing)

create table if not exists public.native_sync_jobs (
  id bigserial primary key,
  github_repo text not null,
  status text not null default 'queued',
  github_run_id bigint,
  run_html_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text
);

create index if not exists native_sync_jobs_repo_idx on public.native_sync_jobs (github_repo);
create index if not exists native_sync_jobs_status_idx on public.native_sync_jobs (status);

create table if not exists public.native_sync_reports (
  id bigserial primary key,
  job_id bigint not null references public.native_sync_jobs(id) on delete cascade,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists native_sync_reports_job_id_idx on public.native_sync_reports (job_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_native_sync_jobs_updated_at on public.native_sync_jobs;
create trigger trg_native_sync_jobs_updated_at
before update on public.native_sync_jobs
for each row execute function public.set_updated_at();
