-- Native sync reports, keyed by build_jobs.id (job_id)

create table if not exists public.native_sync_reports (
  job_id uuid primary key references public.build_jobs(id) on delete cascade,
  github_repo text not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_native_sync_reports_updated_at on public.native_sync_reports;

create trigger trg_native_sync_reports_updated_at
before update on public.native_sync_reports
for each row
execute procedure public.set_updated_at();
