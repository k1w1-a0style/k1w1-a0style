import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 774 signing_android + search_path hardening invariants", () => {
  const migration = read("supabase/migrations/20260412100000_hardening_signing_and_search_path.sql");

  it("replaces broad signing_android deny policy with explicit anon/authenticated scope", () => {
    expect(migration).toContain("drop policy signing_android_deny_all on public.signing_android");
    expect(migration).toContain("create policy signing_android_deny_anon_authenticated on public.signing_android");
    expect(migration).toContain("to anon, authenticated");
    expect(migration).toContain("using (false)");
    expect(migration).toContain("with check (false)");
  });

  it("hardens critical security-definer RPC functions to search_path public, pg_temp", () => {
    expect(migration).toContain("alter function public.enforce_edge_rate_limit(text,text,integer,integer) set search_path = public, pg_temp");
    expect(migration).toContain("alter function public.insert_diagnostic_upload(jsonb) set search_path = public, pg_temp");
  });
});
