const mockSvc = {
  getEdgeAdminKey: jest.fn(),
  getExpoToken: jest.fn(),
  getGitHubToken: jest.fn(),
  getRepoFileText: jest.fn(),
  listRepoSecretNames: jest.fn(),
  triggerWorkflow: jest.fn(),
};

jest.doMock(require.resolve("../infra/github/githubService"), () => mockSvc);
jest.doMock(require.resolve("../lib/supabase"), () => ({ ensureSupabaseClient: jest.fn() }));
const { runBuildPipelineDiagnostics } = require("../lib/diagnostics/buildPipelineDiagnostics");

describe("runBuildPipelineDiagnostics - missing workflows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSvc.getGitHubToken.mockResolvedValue("gh");
    mockSvc.getExpoToken.mockResolvedValue("expo");
    mockSvc.getEdgeAdminKey.mockResolvedValue("admin");
    mockSvc.listRepoSecretNames.mockResolvedValue(["EXPO_TOKEN"]);
    const files: Record<string, string> = {
      "eas.json": JSON.stringify({ build: { preview: { android: { buildType: "apk" } } } }),
      "eas-project.json": JSON.stringify({ projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      "app.json": JSON.stringify({ expo: {} }),
      "package.json": JSON.stringify({ name: "x" }),
    };
    mockSvc.getRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
      if (!(path in files)) throw new Error(`missing ${path}`);
      return files[path];
    });
  });

  it("fails both workflow checks and mentions filenames", async () => {
    const res = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const easLink = res.checks.find((c: any) => c.id === "repo.workflow.easLink");
    const triggered = res.checks.find((c: any) => c.id === "repo.workflow.triggeredBuild");

    expect(easLink?.status).toBe("fail");
    expect(`${easLink?.title} ${easLink?.fixHint ?? ""}`).toMatch(/eas-link\.yml/);

    expect(triggered?.status).toBe("fail");
    expect(`${triggered?.title} ${triggered?.fixHint ?? ""}`).toMatch(/k1w1-triggered-build\.yml/);
  });
});
