-- Fix previews: secret backfill + NOT NULL + cleanup function
-- Robust against pgcrypto being installed in a non-public schema (e.g. extensions)

create extension if not exists pgcrypto;

do $mig$
declare
  pgcrypto_schema text;
begin
  -- Find schema where pgcrypto is installed
  select n.nspname
    into pgcrypto_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if pgcrypto_schema is null then
    raise exception 'pgcrypto extension not found (cannot backfill secrets)';
  end if;

  -- 1) Backfill NULL secrets using schema-qualified gen_random_bytes
  execute format($sql$
    update public.previews
      set secret = encode(%I.gen_random_bytes(24), 'hex')
    where secret is null
  $sql$, pgcrypto_schema);

  -- 2) Set NOT NULL only if still nullable
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'previews'
      and column_name = 'secret'
      and is_nullable = 'YES'
  ) then
    execute 'alter table public.previews alter column secret set not null';
  end if;

  -- 3) Indexes (idempotent)
  execute 'create unique index if not exists previews_secret_ux on public.previews (secret)';
  execute 'create index if not exists previews_expires_at_idx on public.previews (expires_at)';

  -- 4) Cleanup function
  execute $fn$
    create or replace function public.cleanup_expired_previews()
    returns integer
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare deleted_count integer;
    begin
      delete from public.previews where expires_at < now();
      get diagnostics deleted_count = row_count;
      return deleted_count;
    end;
    $body$;
  $fn$;

  execute 'grant execute on function public.cleanup_expired_previews() to service_role';
end
$mig$;
