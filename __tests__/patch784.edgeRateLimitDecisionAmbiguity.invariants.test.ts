import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 784 edge rate-limit decision ambiguity fix", () => {
  const migration = read("supabase/migrations/20260418170000_fix_edge_rate_limit_decision_ambiguity.sql");

  it("qualifies the decision column lookup against edge_rate_limit_events", () => {
    expect(migration).toContain("from public.edge_rate_limit_events as events");
    expect(migration).toContain("and events.decision = 'allowed';");
  });

  it("keeps the semantic decision output contract explicit", () => {
    expect(migration).toContain("returns table (allowed boolean, current_count bigint, decision text)");
    expect(migration).toContain("v_allowed as allowed,");
    expect(migration).toContain("v_allowed_count as current_count,");
    expect(migration).toContain("end as decision;");
  });
});