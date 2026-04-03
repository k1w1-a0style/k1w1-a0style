import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 734 Supabase live-findings repo hardening invariants", () => {
  const migration = read("supabase/migrations/20260403000000_supabase_live_findings_hardening.sql");

  it("re-asserts build_jobs fail-closed RLS for anon/authenticated", () => {
    expect(migration).toContain('drop policy if exists "Public read build_jobs" on public.build_jobs;');
    expect(migration).toContain("revoke all on table public.build_jobs from anon;");
    expect(migration).toContain("revoke all on table public.build_jobs from authenticated;");
    expect(migration).toContain('create policy "Deny read build_jobs"');
  });

  it("hardens legacy cleanup_old_previews(integer) execute scope when present", () => {
    expect(migration).toContain("to_regprocedure('public.cleanup_old_previews(integer)')");
    expect(migration).toContain("alter function public.cleanup_old_previews(integer) set search_path = public, pg_temp");
    expect(migration).toContain("revoke all on function public.cleanup_old_previews(integer) from public");
    expect(migration).toContain("grant execute on function public.cleanup_old_previews(integer) to service_role");
  });

  it("adds explicit deny policies for signing_audit_log", () => {
    expect(migration).toContain("alter table if exists public.signing_audit_log enable row level security;");
    expect(migration).toContain('create policy "Deny read signing_audit_log"');
    expect(migration).toContain('create policy "Deny write signing_audit_log"');
    expect(migration).toContain("with check (false);");
  });
});
