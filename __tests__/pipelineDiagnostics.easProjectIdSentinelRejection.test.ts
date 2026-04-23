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
const { runBuildPipelineDiagnostics } = require("../lib/diagnostics/buildPipelineDiagnostics") as typeof import("../lib/diagnostics/buildPipelineDiagnostics");

const VALID = "11111111-1111-4111-8111-111111111111";
const SENTINEL = "00000000-0000-4000-8000-000000000000";

function setupRepo(repoFiles: Record<string, string>) {
  mockSvc.getGitHubToken.mockResolvedValue("gh");
  mockSvc.getExpoToken.mockResolvedValue("expo");
  mockSvc.getLegacyEdgeAdminKey.mockResolvedValue("admin");
  mockSvc.listRepoSecretNames.mockResolvedValue(["EXPO_TOKEN"]);
  mockSvc.triggerWorkflow.mockResolvedValue({ ok: true });
  mockSvc.getRepoFileText.mockImplementation(async ({ path }: { path: string }) => {
    if (!(path in repoFiles)) throw new Error(`missing file ${path}`);
    return repoFiles[path];
  });
}

describe("runBuildPipelineDiagnostics - EAS projectId sentinel rejection", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects sentinel UUID from eas-project.json and falls back to app.json", async () => {
    setupRepo({
      "eas-project.json": JSON.stringify({ projectId: SENTINEL }),
      "app.json": JSON.stringify({ expo: { extra: { eas: { projectId: VALID } } } }),
      "eas.json": JSON.stringify({ build: { development: {}, preview: {}, production: {} } }),
      "package.json": JSON.stringify({ name: "x", dependencies: {} }),
      ".github/workflows/eas-link.yml": "name: EAS Link",
      ".github/workflows/k1w1-triggered-build.yml": "name: K1W1 Triggered Build",
      "app.config.js": "module.exports = {};",
    });

    const result = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const check = findCheckById(result.checks, "repo.easProjectId");

    expect(check?.status).toBe("pass");
    expect(check?.details).toContain(VALID);
    expect(check?.details).toContain("source: app.json");
  });

  it("fails when only sentinel/dummy projectId values are present", async () => {
    setupRepo({
      "eas-project.json": JSON.stringify({ projectId: SENTINEL }),
      "app.json": JSON.stringify({ expo: { extra: { eas: { projectId: "__UNLINKED_EAS_PROJECT_ID__" } } } }),
      "eas.json": JSON.stringify({ build: { development: {}, preview: {}, production: {} } }),
      "package.json": JSON.stringify({ name: "x", dependencies: {} }),
      ".github/workflows/eas-link.yml": "name: EAS Link",
      ".github/workflows/k1w1-triggered-build.yml": "name: K1W1 Triggered Build",
      "app.config.js": "module.exports = { extra: { eas: { projectId: '00000000-0000-4000-8000-000000000000' } } };",
    });

    const result = await runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
    const check = findCheckById(result.checks, "repo.easProjectId");

    expect(check?.status).toBe("fail");
    expect(check?.fixHint).toContain("Dummy-/Sentinel-IDs");
  });
});
