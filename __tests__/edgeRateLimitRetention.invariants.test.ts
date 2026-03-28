import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("edge_rate_limit_events retention invariants", () => {
  const migration = read("supabase/migrations/20260328100000_edge_rate_limit_events_retention.sql");

  it("adds a prune function with explicit retention and deleted-row count", () => {
    expect(migration).toContain("create or replace function public.prune_edge_rate_limit_events(");
    expect(migration).toContain("p_retention interval default interval '14 days'");
    expect(migration).toContain("get diagnostics deleted_rows = row_count;");
    expect(migration).toContain("returns integer");
  });

  it("locks function execution to service_role", () => {
    expect(migration).toContain("revoke all on function public.prune_edge_rate_limit_events(interval) from public;");
    expect(migration).toContain("grant execute on function public.prune_edge_rate_limit_events(interval) to service_role;");
  });

  it("schedules nightly pruning with pg_cron", () => {
    expect(migration).toContain("create extension if not exists pg_cron;");
    expect(migration).toContain("prune-edge-rate-limit-events-nightly");
    expect(migration).toContain("select public.prune_edge_rate_limit_events(interval '14 days');");
  });
});
