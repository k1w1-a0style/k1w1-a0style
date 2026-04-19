import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analyzeLatestReturnsTableFunctions } = require("../scripts/check_plpgsql_returns_table_ambiguity.js");

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("PL/pgSQL RETURNS TABLE ambiguity guard", () => {
  it("keeps latest RETURNS TABLE function predicates free of unqualified output-column references", () => {
    expect(analyzeLatestReturnsTableFunctions()).toEqual([]);
  });

  it("wires the guard into release readiness", () => {
    const script = read("scripts/check_release_readiness.sh");
    expect(script).toContain('node scripts/check_plpgsql_returns_table_ambiguity.js');
  });

  it("drops only the clearly unused native-sync legacy indexes", () => {
    const migration = read("supabase/migrations/20260418183000_drop_unused_native_sync_indexes.sql");
    expect(migration).toContain("drop index if exists public.native_sync_jobs_repo_idx;");
    expect(migration).toContain("drop index if exists public.native_sync_jobs_status_idx;");
    expect(migration).toContain("drop index if exists public.native_sync_reports_job_id_idx;");
  });
});