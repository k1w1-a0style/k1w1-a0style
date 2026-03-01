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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runBuildPipelineDiagnostics } = require("../lib/diagnostics/buildPipelineDiagnostics");

const UUID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UUID_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function setupRepo(repoFiles: Record<string, string>) {
  mockSvc.getGitHubToken.mockResolvedValue("gh");
  mockSvc.getExpoToken.mockResolvedValue("expo");
  mockSvc.getEdgeAdminKey.mockResolvedValue("admin");
  mockSvc.listRepoSecretNames.mockResolvedValue(["EXPO_TOKEN"]);
  mockSvc.triggerWorkflow.mockResolvedValue({ ok: true });
  mockSvc.getRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
    if (!(path in repoFiles)) throw new Error(`missing file ${path}`);
    return repoFiles[path];
  });
}

describe("runBuildPipelineDiagnostics - EAS projectId source priority", () => {
  beforeEach(() => jest.clearAllMocks());

  it("prefers eas-project.json over app.json and app.config", async () => {
    setupRepo({
      "eas.json": JSON.stringify({ build: { preview: { android: { buildType: "apk" } } } }),
      "eas-project.json": JSON.stringify({ projectId: UUID_A }),
      "app.json": JSON.stringify({ expo: { extra: { eas: { projectId: UUID_B } } } }),
      "app.config.js": `module.exports = { extra: { eas: { projectId: '${UUID_C}' } } }`,
      "package.json": JSON.stringify({ name: "x" }),
      ".github/workflows/eas-link.yml": "name: eas-link",
      ".github/workflows/k1w1-triggered-build.yml": "name: build",
    });

    const res = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const check = res.checks.find((c: any) => c.id === "repo.easProjectId");
    expect(check?.status).toBe("pass");
    expect(check?.details).toContain(UUID_A);
    expect(check?.details).toContain("source: eas-project.json");
  });

  it("uses app.json when eas-project.json is missing", async () => {
    setupRepo({
      "eas.json": JSON.stringify({ build: { preview: { android: { buildType: "apk" } } } }),
      "app.json": JSON.stringify({ expo: { extra: { eas: { projectId: UUID_B } } } }),
      "app.config.js": `module.exports = { extra: { eas: { projectId: '${UUID_C}' } } }`,
      "package.json": JSON.stringify({ name: "x" }),
      ".github/workflows/eas-link.yml": "name: eas-link",
      ".github/workflows/k1w1-triggered-build.yml": "name: build",
    });

    const res = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const check = res.checks.find((c: any) => c.id === "repo.easProjectId");
    expect(check?.status).toBe("pass");
    expect(check?.details).toContain(UUID_B);
    expect(check?.details).toContain("source: app.json");
  });

  it("falls back to app.config heuristic scan", async () => {
    setupRepo({
      "eas.json": JSON.stringify({ build: { preview: { android: { buildType: "apk" } } } }),
      "app.config.js": `export default { extra: { eas: { projectId: '${UUID_C}' } } };`,
      "package.json": JSON.stringify({ name: "x" }),
      ".github/workflows/eas-link.yml": "name: eas-link",
      ".github/workflows/k1w1-triggered-build.yml": "name: build",
    });

    const res = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const check = res.checks.find((c: any) => c.id === "repo.easProjectId");
    expect(check?.status).toBe("pass");
    expect(check?.details).toContain(UUID_C);
    expect(check?.details).toContain("source: app.config");
  });
});
