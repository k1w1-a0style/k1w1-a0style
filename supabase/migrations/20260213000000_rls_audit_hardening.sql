-- 2026-02-13
-- SB-RLS-002: audit & harden table/storage read policies
-- Goal: prevent broad reads for tables that do not have user scoping.

do $$
begin
  -- diagnostic_uploads: deny reads for anon/auth (service_role bypasses RLS)
  alter table if exists public.diagnostic_uploads enable row level security;
  drop policy if exists "diagnostic_uploads_select_authenticated" on public.diagnostic_uploads;
  drop policy if exists "Deny read diagnostic_uploads" on public.diagnostic_uploads;
  create policy "Deny read diagnostic_uploads"
    on public.diagnostic_uploads
    for select
    to anon, authenticated
    using (false);
exception
  when undefined_table then
    raise notice 'public.diagnostic_uploads not found, skipping';
end $$;

do $$
begin
  -- diagnostics_reports: deny reads for anon/auth (use privileged tooling to view)
  alter table if exists public.diagnostics_reports enable row level security;
  drop policy if exists "Allow authenticated read diagnostics reports" on public.diagnostics_reports;
  drop policy if exists "Deny read diagnostics_reports" on public.diagnostics_reports;
  create policy "Deny read diagnostics_reports"
    on public.diagnostics_reports
    for select
    to anon, authenticated
    using (false);
exception
  when undefined_table then
    raise notice 'public.diagnostics_reports not found, skipping';
end $$;

do $$
begin
  -- Storage bucket "signing": lock down storage.objects for anon/auth
  -- (service_role bypasses RLS; explicit deny prevents accidental permissive policies later)
  alter table if exists storage.objects enable row level security;

  drop policy if exists "deny signing bucket read" on storage.objects;
  drop policy if exists "deny signing bucket insert" on storage.objects;
  drop policy if exists "deny signing bucket update" on storage.objects;
  drop policy if exists "deny signing bucket delete" on storage.objects;

  create policy "deny signing bucket read"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'signing' and false);

  create policy "deny signing bucket insert"
    on storage.objects
    for insert
    to anon, authenticated
    with check (bucket_id = 'signing' and false);

  create policy "deny signing bucket update"
    on storage.objects
    for update
    to anon, authenticated
    using (bucket_id = 'signing' and false)
    with check (bucket_id = 'signing' and false);

  create policy "deny signing bucket delete"
    on storage.objects
    for delete
    to anon, authenticated
    using (bucket_id = 'signing' and false);
exception
  when undefined_table then
    raise notice 'storage.objects not found, skipping';
  when insufficient_privilege then
    -- On some Supabase projects the migration role is not the owner of storage.objects.
    -- We still want the rest of the RLS audit hardening to apply.
    raise notice 'insufficient privilege for storage.objects (not owner), skipping storage bucket hardening';
end $$;
