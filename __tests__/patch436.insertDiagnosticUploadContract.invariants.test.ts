import fs from "node:fs";
import path from "node:path";

const legacyDriftMigration = path.join(
  process.cwd(),
  "supabase/migrations/20260203000000_harden_diagnostics_reports_and_rpc.sql",
);

const finalizeMigration = path.join(
  process.cwd(),
  "supabase/migrations/20260315000100_finalize_insert_diagnostic_upload_contract.sql",
);

const finalAuthMigration = path.join(
  process.cwd(),
  "supabase/migrations/20260320000000_restore_insert_diagnostic_upload_anon_client_contract.sql",
);

describe("patch436 insert_diagnostic_upload migration contract", () => {
  it("keeps the historical uuid drift explicit in migration history", () => {
    const sql = fs.readFileSync(legacyDriftMigration, "utf8");

    expect(sql).toContain("create or replace function public.insert_diagnostic_upload(payload jsonb)");
    expect(sql).toContain("returns uuid");
    expect(sql).toContain("repo,");
    expect(sql).toContain("branch,");
    expect(sql).toContain("mode,");
    expect(sql).toContain("platform,");
    expect(sql).toContain("report,");
    expect(sql).toContain("meta");
  });

  it("reasserts the canonical bigint contract and expected table columns", () => {
    const sql = fs.readFileSync(finalizeMigration, "utf8");

    expect(sql).toContain("returns bigint");
    expect(sql).toContain("create or replace function public.insert_diagnostic_upload(payload jsonb)");
    expect(sql).toContain("client_request_id,");
    expect(sql).toContain("app_version,");
    expect(sql).toContain("project_name,");
    expect(sql).toContain("target,");
    expect(sql).toContain("summary,");
    expect(sql).toContain("snapshots,");
    expect(sql).toContain("notes,");
    expect(sql).toContain("on conflict (device_id, client_request_id)");

    expect(sql).toContain(`insert into public.diagnostic_uploads (
    device_id,
    client_request_id,
    app_version,
    project_name,
    target,
    summary,
    snapshots,
    notes,
    ip
  )`);
  });

  it("documents the final anon-compatible client auth contract explicitly", () => {
    const sql = fs.readFileSync(finalAuthMigration, "utf8");

    expect(sql).toContain("Final auth contract for diagnostics uploads");
    expect(sql).toContain("revoke all on function public.insert_diagnostic_upload(jsonb) from public;");
    expect(sql).toContain("revoke all on function public.insert_diagnostic_upload(jsonb) from anon;");
    expect(sql).toContain("revoke all on function public.insert_diagnostic_upload(jsonb) from authenticated;");
    expect(sql).toContain("grant execute on function public.insert_diagnostic_upload(jsonb) to anon;");
    expect(sql).toContain("grant execute on function public.insert_diagnostic_upload(jsonb) to authenticated;");
    expect(sql).toContain("grant execute on function public.insert_diagnostic_upload(jsonb) to service_role;");
    expect(sql).toContain("Client diagnostics upload RPC; callable by anon/authenticated/service_role");
  });
});
