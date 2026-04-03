import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 735 diagnostics_reports + search_path follow-up invariants", () => {
  const followupMigration = read("supabase/migrations/20260403010000_search_path_followup.sql");
  const decisionNote = read("docs/reviews/diagnostics_reports_policy_decision_2026-04-03.md");
  const rlsAuditMigration = read("supabase/migrations/20260213000000_rls_audit_hardening.sql");
  const todo = read("docs/TODO.md");

  it("re-asserts search_path hardening for trigger/cleanup helpers", () => {
    expect(followupMigration).toContain("to_regprocedure('public._diagnostic_upload_guard()')");
    expect(followupMigration).toContain("alter function public._diagnostic_upload_guard() set search_path = public, pg_temp");
    expect(followupMigration).toContain("to_regprocedure('public.cleanup_expired_previews()')");
    expect(followupMigration).toContain("alter function public.cleanup_expired_previews() set search_path = public, pg_temp");
  });

  it("documents diagnostics_reports policy contradiction as an explicit decision point", () => {
    expect(decisionNote).toContain("Kein Blind-Fix an RLS-Policy");
    expect(decisionNote).toContain("Option A");
    expect(decisionNote).toContain("Option B");
    expect(rlsAuditMigration).toContain('create policy "Deny read diagnostics_reports"');
  });

  it("keeps TODO aligned with the clarified diagnostics/search_path status", () => {
    expect(todo).toContain("diagnostics_reports");
    expect(todo).toContain("Decision-Note 2026-04-03");
    expect(todo).toContain("20260403010000_search_path_followup.sql");
  });
});
