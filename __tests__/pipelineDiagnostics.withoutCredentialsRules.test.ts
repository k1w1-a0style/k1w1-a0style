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
const { runBuildPipelineDiagnostics } = require("../lib/diagnostics/buildPipelineDiagnostics") as typeof import("../lib/diagnostics/buildPipelineDiagnostics");

describe("runBuildPipelineDiagnostics - withoutCredentials profile rules", () => {
  it("warns for dev/preview missing and production=true with corrective patches", async () => {
    mockSvc.getGitHubToken.mockResolvedValue("gh");
    mockSvc.getExpoToken.mockResolvedValue("expo");
    mockSvc.getLegacyEdgeAdminKey.mockResolvedValue("admin");
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
    const dev = findCheckById(res.checks, "repo.easAndroidWithoutCreds.development");
    const prev = findCheckById(res.checks, "repo.easAndroidWithoutCreds.preview");
    const prod = findCheckById(res.checks, "repo.easAndroidWithoutCreds.production");
    const devPatch = dev?.fix?.patch?.jsonMerge?.[0]?.patch as
      | { build?: { development?: { android?: { withoutCredentials?: boolean } } } }
      | undefined;
    const prevPatch = prev?.fix?.patch?.jsonMerge?.[0]?.patch as
      | { build?: { preview?: { android?: { withoutCredentials?: boolean } } } }
      | undefined;
    const prodPatch = prod?.fix?.patch?.jsonMerge?.[0]?.patch as
      | { build?: { production?: { android?: { withoutCredentials?: boolean } } } }
      | undefined;

    expect(dev?.status).toBe("warn");
    expect(devPatch?.build?.development?.android?.withoutCredentials).toBe(true);

    expect(prev?.status).toBe("warn");
    expect(prevPatch?.build?.preview?.android?.withoutCredentials).toBe(true);

    expect(prod?.status).toBe("warn");
    expect(prodPatch?.build?.production?.android?.withoutCredentials).toBe(false);
  });
});
