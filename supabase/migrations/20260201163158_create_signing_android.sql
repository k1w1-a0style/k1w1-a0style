-- Signing metadata for Android (Keystore in Supabase Storage)
create table if not exists public.signing_android (
  repo text primary key,
  alias text not null,
  storage_bucket text not null default 'signing',
  storage_path text not null,
  keystore_password_enc text not null,
  key_password_enc text not null,
  mode text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for quick lookup
create index if not exists signing_android_repo_idx on public.signing_android (repo);

-- RLS: only service role should access this table
alter table public.signing_android enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='signing_android' and policyname='signing_android_deny_all'
  ) then
    create policy signing_android_deny_all on public.signing_android
      for all
      using (false)
      with check (false);
  end if;
end $$;
