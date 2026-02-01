-- Fix: earlier migration created password columns as NOT NULL, but we store credentials encrypted in Storage.
-- Make the columns nullable so inserts from edge functions do not fail.
-- Idempotent.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='signing_android' and column_name='keystore_password_enc'
  ) then
    alter table public.signing_android alter column keystore_password_enc drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='signing_android' and column_name='key_password_enc'
  ) then
    alter table public.signing_android alter column key_password_enc drop not null;
  end if;
end $$;
