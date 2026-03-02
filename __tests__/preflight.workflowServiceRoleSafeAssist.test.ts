import { checkWorkflowServiceRoleKeyLeak } from "../lib/diagnostics/checks/workflowSecurity";

describe("workflow service role safe assist", () => {
  it("adds safe replace patch for exact SUPABASE_SERVICE_ROLE_KEY scalar", () => {
    const result = checkWorkflowServiceRoleKeyLeak.run(
      [
        {
          path: ".github/workflows/build.yml",
          content: [
            "name: build",
            "jobs:",
            "  test:",
            "    runs-on: ubuntu-latest",
            "    env:",
            '      SUPABASE_SERVICE_ROLE_KEY: "abcdefghijklmnopqrstuvwxyz1234567890ABCDE"',
          ].join("\n"),
        } as any,
      ],
      { mode: "eas", profile: "all" },
    );

    expect(result.status).toBe("fail");
    expect(result.fix?.patch?.upsert?.[0]?.path).toBe(".github/workflows/build.yml");
    expect(result.fix?.patch?.upsert?.[0]?.content).toContain("${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}");
  });

  it("does not auto-fix non-exact service-role key names", () => {
    const result = checkWorkflowServiceRoleKeyLeak.run(
      [
        {
          path: ".github/workflows/build.yml",
          content: [
            "name: build",
            "jobs:",
            "  test:",
            "    env:",
            '      MY_SERVICE_ROLE_TOKEN: "abcdefghijklmnopqrstuvwxyz1234567890ABCDE"',
          ].join("\n"),
        } as any,
      ],
      { mode: "eas", profile: "all" },
    );

    expect(result.status).toBe("fail");
    expect(result.fix).toBeUndefined();
  });
});
