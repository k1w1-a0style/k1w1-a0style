import { runBuildPipelineDiagnostics } from "../lib/diagnostics/buildPipelineDiagnostics";

describe("runBuildPipelineDiagnostics scoped local admin key readiness", () => {
  const baseDeps = {
    getGitHubToken: jest.fn(async () => "gh-token"),
    getExpoToken: jest.fn(async () => "expo-token"),
    fileExists: jest.fn(async () => true),
    readJsonFile: async <T,>() => ({ build: {} }) as T,
    getRepoFileText: jest.fn(async ({ path }: { path: string }) => {
      if (path === "app.config.js") return "module.exports = {}";
      if (path === "eas.json") return JSON.stringify({ build: {} });
      if (path === "package.json") return JSON.stringify({ name: "demo" });
      if (path === "eas-project.json") {
        return JSON.stringify({ projectId: "11111111-1111-1111-1111-111111111111" });
      }
      return "";
    }),
    listRepoSecretNames: jest.fn(async () => ["EXPO_TOKEN", "SUPABASE_URL"]),
  };

  it("fails workflow readiness when scoped workflow key is missing even if legacy key exists", async () => {
    const result = await runBuildPipelineDiagnostics(
      { owner: "owner", repo: "repo", branch: "main" },
      {
        ...baseDeps,
        getWorkflowAdminKey: jest.fn(async () => null),
        getAndroidKeystoreExportAdminKey: jest.fn(async () => null),
        getLegacyEdgeAdminKey: jest.fn(async () => "legacy-only-key"),
      },
    );

    const workflow = result.checks.find((entry) => entry.id === "local.workflowAdminKey");
    expect(workflow?.status).toBe("fail");
    expect(String(workflow?.fixHint || "")).toMatch(/Workflow.*scoped/i);
    expect(result.checks.some((entry) => entry.id === "local.legacyEdgeAdminKey")).toBe(false);
  });
});
