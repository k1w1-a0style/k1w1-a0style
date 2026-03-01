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

describe("runBuildPipelineDiagnostics - withoutCredentials profile rules", () => {
  it("warns for dev/preview missing and production=true with corrective patches", async () => {
    mockSvc.getGitHubToken.mockResolvedValue("gh");
    mockSvc.getExpoToken.mockResolvedValue("expo");
    mockSvc.getEdgeAdminKey.mockResolvedValue("admin");
    mockSvc.listRepoSecretNames.mockResolvedValue(["EXPO_TOKEN"]);

    const files: Record<string, string> = {
      "eas.json": JSON.stringify({
        build: {
          development: { android: { buildType: "apk" } },
          preview: { android: { buildType: "apk" } },
          production: { android: { buildType: "apk", withoutCredentials: true } },
        },
      }),
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
    const dev = res.checks.find((c: any) => c.id === "repo.easAndroidWithoutCreds.development");
    const prev = res.checks.find((c: any) => c.id === "repo.easAndroidWithoutCreds.preview");
    const prod = res.checks.find((c: any) => c.id === "repo.easAndroidWithoutCreds.production");

    expect(dev?.status).toBe("warn");
    expect(dev?.fix?.patch?.jsonMerge?.[0]?.patch?.build?.development?.android?.withoutCredentials).toBe(true);

    expect(prev?.status).toBe("warn");
    expect(prev?.fix?.patch?.jsonMerge?.[0]?.patch?.build?.preview?.android?.withoutCredentials).toBe(true);

    expect(prod?.status).toBe("warn");
    expect(prod?.fix?.patch?.jsonMerge?.[0]?.patch?.build?.production?.android?.withoutCredentials).toBe(false);
  });
});
