-- Patch 778: Make durable edge rate-limit audits semantically explicit.
-- Separate allowed vs rejected attempts while keeping fail-closed behavior.

alter table if exists public.edge_rate_limit_events
  add column if not exists decision text not null default 'allowed';

create index if not exists edge_rate_limit_events_scope_subject_decision_created_idx
  on public.edge_rate_limit_events (scope, subject, decision, created_at desc);

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
  from public.edge_rate_limit_events
  where scope = p_scope
    and subject = p_subject
    and created_at >= v_window_start
    and decision = 'allowed';

  v_allowed := v_allowed_count < p_max;

  insert into public.edge_rate_limit_events (scope, subject, decision, created_at)
  values (p_scope, p_subject, case when v_allowed then 'allowed' else 'rejected' end, v_now);

  if v_allowed then
    v_allowed_count := v_allowed_count + 1;
  end if;

  return query
  select v_allowed, v_allowed_count, case when v_allowed then 'allowed' else 'rejected' end;
end;
$$;

revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from public;
revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.enforce_edge_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.enforce_edge_rate_limit(text, text, integer, integer) to service_role;
