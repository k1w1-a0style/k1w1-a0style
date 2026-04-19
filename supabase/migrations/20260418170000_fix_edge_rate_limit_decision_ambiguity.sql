-- Fix live/runtime ambiguity introduced by the decision output column name.
-- In plpgsql, RETURNS TABLE output names behave like variables. After adding
-- `decision` to the return type, the unqualified WHERE predicate
-- `decision = 'allowed'` became ambiguous against the table column.

create or replace function public.enforce_edge_rate_limit(
  p_scope text,
  p_subject text,
  p_max integer,
  p_window_ms integer
)
returns table (allowed boolean, current_count bigint, decision text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_allowed_count bigint;
  v_key text;
  v_allowed boolean;
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

  select count(*)
  into v_allowed_count
  from public.edge_rate_limit_events as events
  where events.scope = p_scope
    and events.subject = p_subject
    and events.created_at >= v_window_start
    and events.decision = 'allowed';

  v_allowed := v_allowed_count < p_max;

  insert into public.edge_rate_limit_events (scope, subject, decision, created_at)
  values (p_scope, p_subject, case when v_allowed then 'allowed' else 'rejected' end, v_now);

  if v_allowed then
    v_allowed_count := v_allowed_count + 1;
  end if;

  return query
  select
    v_allowed as allowed,
    v_allowed_count as current_count,
    case when v_allowed then 'allowed' else 'rejected' end as decision;
end;
$$;

revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from public;
revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.enforce_edge_rate_limit(text, text, integer, integer) to service_role;