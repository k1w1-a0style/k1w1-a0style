-- Ensure signing_android can store separate rows per repo + build mode.
-- Existing installs may have a single row with mode NULL; we normalize it to 'production'.

begin;

-- Mode must always be set for our new composite key.
update public.signing_android
set mode = 'production'
where mode is null;

alter table public.signing_android
  alter column mode set not null;

-- Replace old primary key (repo) with composite primary key (repo, mode).
do $$
declare
  pk_name text;
begin
  select constraint_name into pk_name
  from information_schema.table_constraints
  where table_schema='public'
    and table_name='signing_android'
    and constraint_type='PRIMARY KEY'
  limit 1;

  if pk_name is not null then
    execute format('alter table public.signing_android drop constraint %I', pk_name);
  end if;
end $$;

alter table public.signing_android
  add constraint signing_android_pkey primary key (repo, mode);

commit;
