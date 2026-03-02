const mockSvc = {
  getEdgeAdminKey: jest.fn(),
  getExpoToken: jest.fn(),
  getGitHubToken: jest.fn(),
  getRepoFileText: jest.fn(),
  listRepoSecretNames: jest.fn(),
};

jest.doMock(require.resolve("../infra/github/githubService"), () => mockSvc);
jest.doMock(require.resolve("../lib/supabase"), () => ({ ensureSupabaseClient: jest.fn() }));

const { runBuildPipelineDiagnostics } = require("../lib/diagnostics/buildPipelineDiagnostics");

describe("pipeline diagnostics P0 autofix actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSvc.getGitHubToken.mockResolvedValue("gh");
    mockSvc.getExpoToken.mockResolvedValue("expo");
    mockSvc.getEdgeAdminKey.mockResolvedValue("admin");
    mockSvc.listRepoSecretNames.mockResolvedValue(["EXPO_TOKEN"]);
  });

  it("adds workflowDispatch fix for repo.easProjectId fail", async () => {
    const files: Record<string, string> = {
      "eas.json": JSON.stringify({ build: { development: {}, preview: {}, production: {} } }),
      "package.json": JSON.stringify({ name: "x" }),
      ".github/workflows/k1w1-triggered-build.yml": "name: build",
    };
    mockSvc.getRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
      if (!(path in files)) throw new Error(`missing ${path}`);
      return files[path];
    });

    const res = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const check = res.checks.find((c: any) => c.id === "repo.easProjectId");

    expect(check?.status).toBe("fail");
    expect(check?.fix?.workflowDispatch?.workflowFileName).toBe("eas-link.yml");
    expect(check?.fix?.label).toBe("EAS Projekt verbinden (Auto)");
  });

  it("adds canonical eas upsert fix when eas.json is missing", async () => {
    const files: Record<string, string> = {
      "package.json": JSON.stringify({ name: "x" }),
      ".github/workflows/eas-link.yml": "name: link",
      ".github/workflows/k1w1-triggered-build.yml": "name: build",
    };
    mockSvc.getRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
      if (!(path in files)) throw new Error(`missing ${path}`);
      return files[path];
    });

    const res = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const check = res.checks.find((c: any) => c.id === "repo.easJson");

    expect(check?.status).toBe("fail");
    expect(check?.fix?.patch?.upsert?.[0]?.path).toBe("eas.json");
  });

  it("adds additive jsonMerge fix for missing build.preview profile", async () => {
    const files: Record<string, string> = {
      "eas.json": JSON.stringify({
        cli: { version: ">= 10.0.0" },
        build: {
          development: { android: { buildType: "apk" }, customKey: true },
          production: { android: { buildType: "apk" } },
        },
      }),
      "package.json": JSON.stringify({ name: "x" }),
      ".github/workflows/eas-link.yml": "name: link",
      ".github/workflows/k1w1-triggered-build.yml": "name: build",
    };
    mockSvc.getRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
      if (!(path in files)) throw new Error(`missing ${path}`);
      return files[path];
    });

    const res = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const check = res.checks.find((c: any) => c.id === "repo.easProfile.preview");

    expect(check?.status).toBe("fail");
    expect(check?.fix?.patch?.jsonMerge?.[0]?.path).toBe("eas.json");
    expect(check?.fix?.patch?.jsonMerge?.[0]?.patch?.build?.preview?.android?.buildType).toBe("apk");
  });
});
