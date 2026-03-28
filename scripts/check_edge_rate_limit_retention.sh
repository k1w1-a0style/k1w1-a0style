#!/usr/bin/env bash
set -euo pipefail

MIGRATION="supabase/migrations/20260328100000_edge_rate_limit_events_retention.sql"

if [ ! -f "$MIGRATION" ]; then
  echo "Missing migration: $MIGRATION" >&2
  exit 1
fi

grep -Fq 'create or replace function public.prune_edge_rate_limit_events(' "$MIGRATION"
grep -Fq "p_retention interval default interval '14 days'" "$MIGRATION"
grep -Fq 'get diagnostics deleted_rows = row_count;' "$MIGRATION"
grep -Fq 'grant execute on function public.prune_edge_rate_limit_events(interval) to service_role;' "$MIGRATION"
grep -Fq 'create extension if not exists pg_cron;' "$MIGRATION"
grep -Fq 'prune-edge-rate-limit-events-nightly' "$MIGRATION"
grep -Fq "select public.prune_edge_rate_limit_events(interval '14 days');" "$MIGRATION"

echo "Edge rate-limit retention contract OK"
