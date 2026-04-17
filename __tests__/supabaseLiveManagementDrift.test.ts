const {
  classifyFunctionDrift,
  deriveProjectRef,
  extractPublicTables,
  parseFunctionConfigToml,
} = require("../scripts/check_supabase_live_management_drift.js");

describe("check_supabase_live_management_drift helpers", () => {
  it("parses function config from root supabase config", () => {
    const parsed = parseFunctionConfigToml(`
[functions.trigger-lint]
enabled = false
verify_jwt = true

[functions.preview_page]
enabled = true
verify_jwt = false
`);

    expect(parsed).toEqual({
      "trigger-lint": { enabled: false, verify_jwt: true },
      preview_page: { enabled: true, verify_jwt: false },
    });
  });

  it("derives project ref from EDGE_BASE_URL", () => {
    expect(
      deriveProjectRef({
        projectRef: "",
        edgeBaseUrl: "https://xfgnzpcljsuqqdjlxgul.supabase.co/functions/v1",
      }),
    ).toBe("xfgnzpcljsuqqdjlxgul");
  });

  it("classifies critical live drift for disabled repo functions that stay active live", () => {
    const drift = classifyFunctionDrift(
      {
        "trigger-lint": { enabled: false, verify_jwt: true },
      },
      [
        {
          slug: "trigger-lint",
          status: "ACTIVE",
          verify_jwt: false,
        },
      ],
    );

    expect(drift).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "trigger-lint",
          severity: "critical",
          issue: "verify_jwt_drift",
        }),
        expect.objectContaining({
          slug: "trigger-lint",
          severity: "critical",
          issue: "disabled_in_repo_but_active_live",
        }),
      ]),
    );
  });

  it("extracts public tables from database context payload", () => {
    const tables = extractPublicTables({
      databases: [
        {
          schemas: [
            { name: "auth", tables: [{ name: "users" }] },
            { name: "public", tables: [{ name: "previews" }, { name: "build_jobs" }] },
          ],
        },
      ],
    });

    expect(tables).toEqual(["build_jobs", "previews"]);
  });
});