import {
  getRepoSecretCheckTitle,
  runBuildPipelineDiagnostics,
} from "../lib/diagnostics/buildPipelineDiagnostics";

describe("runBuildPipelineDiagnostics secret contract semantics", () => {
  const baseDeps = {
    getGitHubToken: jest.fn(async () => "gh-token"),
    getExpoToken: jest.fn(async () => "expo-token"),
    getEdgeAdminKey: jest.fn(async () => "edge-key"),
    fileExists: jest.fn(async () => true),
    readJsonFile: async <T,>() => ({ build: {} }) as T,
    getRepoFileText: jest.fn(async ({ path }: { path: string }) => {
      if (path === "app.config.js") return "module.exports = {}";
      if (path === "eas.json") return JSON.stringify({ build: {} });
      if (path === "package.json") return JSON.stringify({ name: "demo" });
      if (path === "eas-project.json") {
        return JSON.stringify({
          projectId: "11111111-1111-1111-1111-111111111111",
        });
      }
      return "";
    }),
  };

  it("treats a listed SUPABASE_URL repo secret as verified instead of unknown", async () => {
    const result = await runBuildPipelineDiagnostics(
      { owner: "owner", repo: "repo", branch: "main" },
      {
        ...baseDeps,
        listRepoSecretNames: jest.fn(async () => ["SUPABASE_URL"]),
      },
    );

    const check = result.checks.find((entry) => entry.id === "repo.secret.supabaseUrl");
    expect(check?.status).toBe("pass");
    expect(check?.title).toBe("Repo Secret bestätigt: SUPABASE_URL");
    expect(String(check?.fixHint || "")).toBe("");
  });

  it("keeps an empty successful secret list actionable as missing", async () => {
    const result = await runBuildPipelineDiagnostics(
      { owner: "owner", repo: "repo", branch: "main" },
      {
        ...baseDeps,
        listRepoSecretNames: jest.fn(async () => []),
      },
    );

    const missingExpo = result.checks.find((entry) => entry.id === "repo.secret.expoToken");
    const missingSupabase = result.checks.find((entry) => entry.id === "repo.secret.supabaseUrl");

    expect(missingExpo?.status).toBe("fail");
    expect(missingExpo?.title).toBe("Repo Secret fehlt: EXPO_TOKEN");
    expect(String(missingExpo?.fixHint || "")).toMatch(/EXPO_TOKEN/);
    expect(String(missingExpo?.fixHint || "")).toMatch(/fehlt/i);

    expect(missingSupabase?.status).toBe("warn");
    expect(missingSupabase?.title).toBe("Repo Secret fehlt: SUPABASE_URL");
    expect(String(missingSupabase?.fixHint || "")).toMatch(/SUPABASE_URL/);
    expect(String(missingSupabase?.fixHint || "")).toMatch(/fehlt/i);
  });

  it("keeps auth or permission failures distinct from missing secrets", async () => {
    const result = await runBuildPipelineDiagnostics(
      { owner: "owner", repo: "repo", branch: "main" },
      {
        ...baseDeps,
        listRepoSecretNames: jest.fn(async () => {
          throw new Error("403 Forbidden");
        }),
      },
    );

    const check = result.checks.find((entry) => entry.id === "repo.secret.list");
    expect(check?.status).toBe("warn");
    expect(String(check?.fixHint || "")).toMatch(/secrets-rechte|nicht verifiziert/i);
    expect(String(check?.fixHint || "")).not.toMatch(/fehlt/i);
  });

  it("never uses a false 'vorhanden' title for unknown or auth secret states", () => {
    expect(getRepoSecretCheckTitle({ name: "SUPABASE_URL", state: "unknown" })).toBe(
      "Repo Secret Status unklar: SUPABASE_URL",
    );
    expect(getRepoSecretCheckTitle({ name: "SUPABASE_URL", state: "auth_error" })).toBe(
      "Repo Secret Zugriff unklar: SUPABASE_URL",
    );
    expect(getRepoSecretCheckTitle({ name: "SUPABASE_URL", state: "unknown" })).not.toMatch(
      /vorhanden/i,
    );
    expect(getRepoSecretCheckTitle({ name: "SUPABASE_URL", state: "auth_error" })).not.toMatch(
      /vorhanden/i,
    );
  });
});
