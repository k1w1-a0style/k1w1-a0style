import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

describe("patch507 schema public reference invariants", () => {
  const schemaSnapshot = read("supabase/schema.public.sql");
  const tableMigration = read("supabase/migrations/20260112000100_diagnostic_uploads.sql");
  const reportsMigration = read("supabase/migrations/20260110000100_diagnostics_reports.sql");
  const finalizeMigration = read("supabase/migrations/20260315000100_finalize_insert_diagnostic_upload_contract.sql");
  const authMigration = read("supabase/migrations/20260320000000_restore_insert_diagnostic_upload_anon_client_contract.sql");
  const rlsAuditMigration = read("supabase/migrations/20260213000000_rls_audit_hardening.sql");

  function uploadSnapshotSection(): string {
    const startMarker = "-- CURRENT SNAPSHOT: diagnostics upload contracts";
    const endMarker = "-- CURRENT SNAPSHOT: diagnostics history table used by tooling";
    const startIndex = schemaSnapshot.indexOf(startMarker);
    const endIndex = schemaSnapshot.indexOf(endMarker);

    return schemaSnapshot.slice(startIndex, endIndex > -1 ? endIndex : undefined);
  }

  it("marks schema.public.sql as a derived secondary reference instead of pretending to be SoT", () => {
    expect(schemaSnapshot.trim().length).toBeGreaterThan(0);
    expect(schemaSnapshot).toContain("Derived secondary reference");
    expect(schemaSnapshot).toContain("Canonical source of truth (SoT)");
    expect(schemaSnapshot).toContain("supabase/migrations/*.sql");
    expect(schemaSnapshot).toContain("DB/RPC invariant tests under __tests__/");
  });

  it("keeps the current diagnostics upload snapshot aligned with the canonical bigint contract", () => {
    expect(schemaSnapshot).toContain("create table if not exists public.diagnostic_uploads");
    expect(schemaSnapshot).toContain("client_request_id uuid not null default gen_random_uuid()");
    expect(schemaSnapshot).toContain("create unique index if not exists diagnostic_uploads_device_client_request_uidx");
    expect(schemaSnapshot).toContain("public.insert_diagnostic_upload(payload jsonb) -> bigint");
    expect(schemaSnapshot).toContain("execute for anon, authenticated, service_role");

    expect(finalizeMigration).toContain("returns bigint");
    expect(finalizeMigration).toContain("client_request_id,");
    expect(authMigration).toContain("grant execute on function public.insert_diagnostic_upload(jsonb) to anon;");
    expect(authMigration).toContain("grant execute on function public.insert_diagnostic_upload(jsonb) to authenticated;");
    expect(authMigration).toContain("grant execute on function public.insert_diagnostic_upload(jsonb) to service_role;");
  });

  it("does not reintroduce the historical uuid or legacy column drift into the current upload snapshot", () => {
    const uploadSnapshot = uploadSnapshotSection();

    expect(uploadSnapshot).not.toContain("returns uuid");

    for (const legacyColumn of ["repo", "branch", "mode", "platform", "report", "meta"]) {
      expect(uploadSnapshot).not.toMatch(new RegExp(`\\b${legacyColumn}\\b`));
    }

    expect(tableMigration).not.toMatch(/\brepo\b|\bbranch\b|\bmode\b|\bplatform\b|\breport\b|\bmeta\b/);
  });

  it("keeps diagnostics history visibility honest in the snapshot", () => {
    expect(schemaSnapshot).toContain("create table if not exists public.diagnostics_reports");
    expect(schemaSnapshot).toContain("no public diagnostics history RPC is part of the current app contract");
    expect(schemaSnapshot).toContain("anon/authenticated reads are denied by policy");

    expect(reportsMigration).toContain("create table if not exists public.diagnostics_reports");
    expect(rlsAuditMigration).toContain('create policy "Deny read diagnostics_reports"');
  });
});
