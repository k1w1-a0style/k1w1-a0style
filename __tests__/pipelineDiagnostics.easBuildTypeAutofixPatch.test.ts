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
const { runBuildPipelineDiagnostics } = require("../lib/diagnostics/buildPipelineDiagnostics");

async function runWithBuildType(buildType: string | undefined) {
  const previewAndroid = buildType ? { buildType } : {};
  const files: Record<string, string> = {
    "eas.json": JSON.stringify({ build: { development: { android: { buildType: "apk" } }, preview: { android: previewAndroid }, production: { android: { buildType: "apk" } } } }),
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
  return runBuildPipelineDiagnostics({ owner: "o", repo: "r", branch: "main" });
}

describe("runBuildPipelineDiagnostics - preview buildType autofix", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSvc.getGitHubToken.mockResolvedValue("gh");
    mockSvc.getExpoToken.mockResolvedValue("expo");
    mockSvc.getLegacyEdgeAdminKey.mockResolvedValue("admin");
    mockSvc.listRepoSecretNames.mockResolvedValue(["EXPO_TOKEN"]);
  });

  it("warns when unset and offers patch to apk", async () => {
    const res = await runWithBuildType(undefined);
    const check = findCheckById(res.checks, "repo.easBuildType.preview");
    expect(check?.status).toBe("warn");
    expect(check?.fix?.patch?.jsonMerge?.[0]?.patch?.build?.preview?.android?.buildType).toBe("apk");
  });

  it("fails when not apk and offers patch to apk", async () => {
    const res = await runWithBuildType("app-bundle");
    const check = findCheckById(res.checks, "repo.easBuildType.preview");
    expect(check?.status).toBe("fail");
    expect(check?.fix?.patch?.jsonMerge?.[0]?.patch?.build?.preview?.android?.buildType).toBe("apk");
  });
});
