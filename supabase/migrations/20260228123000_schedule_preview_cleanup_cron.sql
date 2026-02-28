-- Schedule periodic cleanup for expired preview rows.
-- Idempotent and safe to re-run.

create extension if not exists pg_cron;

do $mig$
begin
  -- Remove old schedule if present to avoid duplicates with changed cadence/command.
  if exists (select 1 from cron.job where jobname = 'cleanup-expired-previews-hourly') then
    perform cron.unschedule('cleanup-expired-previews-hourly');
  end if;

  perform cron.schedule(
    'cleanup-expired-previews-hourly',
    '0 * * * *',
    $$select public.cleanup_expired_previews();$$
  );
end
$mig$;
