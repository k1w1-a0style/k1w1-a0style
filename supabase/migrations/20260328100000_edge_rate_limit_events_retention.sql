-- Patch 591: add explicit retention primitives for durable edge rate-limit events.

create or replace function public.prune_edge_rate_limit_events(
  p_retention interval default interval '14 days'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_rows integer := 0;
begin
  if p_retention is null or p_retention <= interval '0 seconds' then
    raise exception 'Retention must be a positive interval';
  end if;

  delete from public.edge_rate_limit_events
  where created_at < now() - p_retention;

  get diagnostics deleted_rows = row_count;
  return deleted_rows;
end;
$$;

revoke all on function public.prune_edge_rate_limit_events(interval) from public;
revoke all on function public.prune_edge_rate_limit_events(interval) from anon;
revoke all on function public.prune_edge_rate_limit_events(interval) from authenticated;
grant execute on function public.prune_edge_rate_limit_events(interval) to service_role;

-- pg_cron is already used in this repository (see preview cleanup schedule).
create extension if not exists pg_cron;

-- Idempotent schedule: run every night at 03:17 UTC.
do $$
begin
  perform cron.unschedule('prune-edge-rate-limit-events-nightly');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'prune-edge-rate-limit-events-nightly',
  '17 3 * * *',
  $$select public.prune_edge_rate_limit_events(interval '14 days');$$
);
