-- Create storage bucket for encrypted signing artifacts (Android keystore)
-- Note: Supabase Storage uses Postgres schema `storage`.
-- This migration is idempotent.

do $$
begin
  -- Ensure bucket exists
  insert into storage.buckets (id, name, public)
  values ('signing', 'signing', false)
  on conflict (id) do nothing;
exception
  when undefined_table then
    -- Storage extension not enabled in this DB; ignore.
    null;
end $$;
