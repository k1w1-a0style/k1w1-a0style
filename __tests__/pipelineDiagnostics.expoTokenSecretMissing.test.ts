import { findCheckById } from "./helpers/diagnosticTestHelpers";

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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runBuildPipelineDiagnostics } = require("../lib/diagnostics/buildPipelineDiagnostics");

describe("runBuildPipelineDiagnostics - missing EXPO_TOKEN repo secret", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSvc.getGitHubToken.mockResolvedValue("gh");
    mockSvc.getExpoToken.mockResolvedValue("expo");
    mockSvc.getLegacyEdgeAdminKey.mockResolvedValue("admin");
    mockSvc.listRepoSecretNames.mockResolvedValue([]);

    const repoFiles: Record<string, string> = {
      "eas.json": JSON.stringify({ build: { preview: { android: { buildType: "apk" } } } }),
      "app.json": JSON.stringify({ expo: { slug: "x", owner: "owner" } }),
      "eas-project.json": JSON.stringify({ projectId: "11111111-1111-1111-1111-111111111111" }),
      "package.json": JSON.stringify({ scripts: { lint: "eslint .", typecheck: "tsc --noEmit" } }),
      ".github/workflows/eas-link.yml": "name: eas-link",
      ".github/workflows/k1w1-triggered-build.yml": "name: build",
    };

    mockSvc.getRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
      if (!(path in repoFiles)) throw new Error(`missing file ${path}`);
      return repoFiles[path];
    });
    mockSvc.triggerWorkflow.mockResolvedValue({ ok: true });
  });

  it("emits FAIL for repo.secret.expoToken and references EXPO_TOKEN", async () => {
    const res = await runBuildPipelineDiagnostics({
      owner: "k1w1-a0style",
      repo: "musik-player",
      branch: "main",
    });

    const check = findCheckById(res.checks, "repo.secret.expoToken");
    expect(check).toBeTruthy();
    expect(check.status).toBe("fail");
    expect(`${check.title} ${check.fixHint ?? ""}`).toMatch(/EXPO_TOKEN/);
  });
});
