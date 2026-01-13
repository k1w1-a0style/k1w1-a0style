begin;

-- 1) Remove legacy overload if it exists (avoid confusion)
drop function if exists public.insert_diagnostic_upload(text, text, text, text, jsonb, jsonb, text, uuid);

-- 2) Lock down EXECUTE to explicit roles only
revoke all on function public.insert_diagnostic_upload(jsonb) from public;
grant execute on function public.insert_diagnostic_upload(jsonb) to anon, authenticated;

-- 3) (Optional but recommended) indexes for rate limiting queries
create index if not exists diagnostic_uploads_ip_created_at_idx
  on public.diagnostic_uploads (ip, created_at desc);

create index if not exists diagnostic_uploads_device_created_at_idx
  on public.diagnostic_uploads (device_id, created_at desc);

commit;
