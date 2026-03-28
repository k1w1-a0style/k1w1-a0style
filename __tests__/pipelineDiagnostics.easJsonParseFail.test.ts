const mockSvc = {
  getLegacyEdgeAdminKey: jest.fn(),
  getExpoToken: jest.fn(),
  getGitHubToken: jest.fn(),
  getRepoFileText: jest.fn(),
  listRepoSecretNames: jest.fn(),
  triggerWorkflow: jest.fn(),
};

jest.doMock(require.resolve("../infra/github/githubService"), () => mockSvc);
jest.doMock(require.resolve("../lib/supabase"), () => ({ ensureSupabaseClient: jest.fn() }));
const { runBuildPipelineDiagnostics } = require("../lib/diagnostics/buildPipelineDiagnostics");

describe("runBuildPipelineDiagnostics - invalid eas.json", () => {
  it("emits repo.easJson.parse fail", async () => {
    mockSvc.getGitHubToken.mockResolvedValue("gh");
    mockSvc.getExpoToken.mockResolvedValue("expo");
    mockSvc.getLegacyEdgeAdminKey.mockResolvedValue("admin");
    mockSvc.listRepoSecretNames.mockResolvedValue(["EXPO_TOKEN"]);

    const files: Record<string, string> = {
      "eas.json": "{ invalid-json",
      "app.json": JSON.stringify({ expo: {} }),
      "eas-project.json": JSON.stringify({ projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      "package.json": JSON.stringify({ name: "x" }),
      ".github/workflows/eas-link.yml": "name: x",
      ".github/workflows/k1w1-triggered-build.yml": "name: y",
    };
    mockSvc.getRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
      if (!(path in files)) throw new Error(`missing ${path}`);
      return files[path];
    });

    const res = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const parseCheck = res.checks.find((c: any) => c.id === "repo.easJson.parse");
    expect(parseCheck?.status).toBe("fail");
    expect(`${parseCheck?.title} ${parseCheck?.fixHint ?? ""}`).toMatch(/parse|JSON|Unexpected|invalid/i);
  });
});
