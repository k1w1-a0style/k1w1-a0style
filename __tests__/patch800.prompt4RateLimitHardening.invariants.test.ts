import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Patch 800 prompt-4 rate-limit hardening invariants", () => {
  it("hardens durable RL advisory lock keying and avoids rejected-row writes", () => {
    const migration = read("supabase/migrations/20260420120000_prompt4_rate_limit_locking_and_write_hardening.sql");

    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(v_key, 0));");
    expect(migration).not.toContain("pg_advisory_xact_lock(hashtext(v_key));");
    expect(migration).toContain("if v_allowed then");
    expect(migration).toContain("values (p_scope, p_subject, 'allowed', v_now);");
    expect(migration).toContain("case when v_allowed then 'allowed' else 'rejected' end as decision;");
  });

  it("removes the redundant late empty-ref check from determine-ref action", () => {
    const action = read(".github/actions/determine-ref/action.yml");
    expect(action).not.toContain('echo "❌ Ref not allowed: $REF"');
    expect(action).toContain("printf 'checkout_ref=%s\\n' \"$REF\" >> \"$GITHUB_OUTPUT\"");
  });

  it("keeps dispatch rate-limit subjecting aligned to verified actor fallback", () => {
    const dispatch = read("supabase/functions/github-workflow-dispatch/index.ts");
    expect(dispatch).toContain("requireWorkflowOperatorJwtRoleWithVerifiedActor");
    expect(dispatch).not.toContain("resolveVerifiedJwtActor");
    expect(dispatch).toContain("const actorSubject = jwtActorGuard.actor;");
    expect(dispatch).toContain("const rateLimitSubject = getRequestRateLimitSubject(req, actorSubject);");
    expect(dispatch).toContain("subject: rateLimitSubject");
    expect(dispatch).toContain('rateLimit(req, "github-workflow-dispatch", 10, 10_000, rateLimitSubject)');
  });
});
