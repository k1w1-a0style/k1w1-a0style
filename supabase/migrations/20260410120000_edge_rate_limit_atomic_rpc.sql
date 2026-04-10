-- Atomic durable rate-limit decision for edge routes.
-- Uses per-key advisory transaction locks to avoid insert/count races under parallel bursts.

create or replace function public.enforce_edge_rate_limit(
  p_scope text,
  p_subject text,
  p_max integer,
  p_window_ms integer
)
returns table (allowed boolean, current_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count bigint;
  v_key text;
begin
  if p_scope is null or btrim(p_scope) = '' then
    raise exception 'p_scope must be non-empty';
  end if;
  if p_subject is null or btrim(p_subject) = '' then
    raise exception 'p_subject must be non-empty';
  end if;
  if p_max is null or p_max < 1 then
    raise exception 'p_max must be >= 1';
  end if;
  if p_window_ms is null or p_window_ms < 1 then
    raise exception 'p_window_ms must be >= 1';
  end if;

  v_window_start := v_now - (p_window_ms::text || ' milliseconds')::interval;
  v_key := p_scope || ':' || p_subject;

  perform pg_advisory_xact_lock(hashtext(v_key));

  insert into public.edge_rate_limit_events (scope, subject, created_at)
  values (p_scope, p_subject, v_now);

  select count(*)
  into v_count
  from public.edge_rate_limit_events
  where scope = p_scope
    and subject = p_subject
    and created_at >= v_window_start;

  return query
  select (v_count <= p_max), v_count;
end;
$$;

revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from public;
revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.enforce_edge_rate_limit(text, text, integer, integer) to service_role;
