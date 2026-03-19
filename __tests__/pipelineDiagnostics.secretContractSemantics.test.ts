import { runBuildPipelineDiagnostics } from "../lib/diagnostics/buildPipelineDiagnostics";

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
      if (path === "eas-project.json") return JSON.stringify({ projectId: "11111111-1111-1111-1111-111111111111" });
      return "";
    }),
  };

  it("keeps auth/permission failures distinct from missing secrets", async () => {
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

  it("keeps real missing secrets actionable as missing", async () => {
    const result = await runBuildPipelineDiagnostics(
      { owner: "owner", repo: "repo", branch: "main" },
      {
        ...baseDeps,
        listRepoSecretNames: jest.fn(async () => []),
      },
    );

    const missingExpo = result.checks.find((entry) => entry.id === "repo.secret.expoToken");
    expect(missingExpo?.status).toBe("fail");
    expect(String(missingExpo?.fixHint || "")).toMatch(/EXPO_TOKEN/);
    expect(String(missingExpo?.fixHint || "")).toMatch(/fehlt/i);
  });
});
