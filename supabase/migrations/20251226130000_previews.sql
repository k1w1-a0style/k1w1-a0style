create extension if not exists pgcrypto;

-- Core table
create table if not exists public.previews (
  id uuid primary key default gen_random_uuid(),
  secret text not null,
  name text not null default 'Preview',
  project_id text,
  files jsonb not null,
  dependencies jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

-- Make sure columns exist even if table already existed
alter table if exists public.previews
  add column if not exists secret text;

alter table if exists public.previews
  add column if not exists name text;

alter table if exists public.previews
  add column if not exists project_id text;

alter table if exists public.previews
  add column if not exists files jsonb;

alter table if exists public.previews
  add column if not exists dependencies jsonb;

alter table if exists public.previews
  add column if not exists meta jsonb;

alter table if exists public.previews
  add column if not exists created_at timestamptz;

alter table if exists public.previews
  add column if not exists expires_at timestamptz;

-- Defaults (safe)
alter table public.previews
  alter column name set default 'Preview';

alter table public.previews
  alter column dependencies set default '{}'::jsonb;

alter table public.previews
  alter column meta set default '{}'::jsonb;

alter table public.previews
  alter column expires_at set default (now() + interval '2 hours');

-- Backfill expires_at if needed
update public.previews
set expires_at = now() + interval '2 hours'
where expires_at is null;

-- RLS: nobody directly (only service_role via Edge Functions)
alter table public.previews enable row level security;

drop policy if exists "Service role full access" on public.previews;

create policy "Service role full access"
on public.previews
for all
to service_role
using (true)
with check (true);

-- Indexes
create unique index if not exists previews_secret_ux
  on public.previews (secret);

create index if not exists previews_expires_at_idx
  on public.previews (expires_at);
