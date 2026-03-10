import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 412 Supabase RLS hardening invariants", () => {
  const migration = read("supabase/migrations/20260310000020_security_definer_rls_hardening.sql");
  const guard = read("scripts/check_supabase_rls_hardening.sh");

  it("locks the diagnostic trigger helper to an explicit search_path and no public execute", () => {
    expect(migration).toContain("create or replace function public._diagnostic_upload_guard()");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("revoke all on function public._diagnostic_upload_guard() from public;");
  });

  it("keeps cleanup_expired_previews service-role only", () => {
    expect(migration).toContain("revoke all on function public.cleanup_expired_previews() from public;");
    expect(migration).toContain("grant execute on function public.cleanup_expired_previews() to service_role;");
  });

  it("keeps insert_diagnostic_upload off PUBLIC while preserving authenticated + service_role execute", () => {
    expect(migration).toContain("revoke all on function public.insert_diagnostic_upload(jsonb) from public;");
    expect(migration).toContain("grant execute on function public.insert_diagnostic_upload(jsonb) to authenticated;");
    expect(migration).toContain("grant execute on function public.insert_diagnostic_upload(jsonb) to service_role;");
  });

  it("guard script checks the privileged function hardening contract", () => {
    expect(guard).toContain("_diagnostic_upload_guard");
    expect(guard).toContain("cleanup_expired_previews");
    expect(guard).toContain("insert_diagnostic_upload(jsonb)");
    expect(guard).toContain("set search_path = public, pg_temp");
  });
});
