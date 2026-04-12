import { pushFilesToRepoAdvanced } from "../infra/github/files/gitDataApi";

const mockGetGitHubToken = jest.fn();
const mockFetchGitHub = jest.fn();

jest.mock("../infra/github/tokenStore", () => ({
  getGitHubToken: (...args: unknown[]) => mockGetGitHubToken(...args),
}));

jest.mock("../infra/github/rateLimit", () => ({
  githubLimiter: {
    checkLimit: jest.fn(async () => undefined),
  },
}));

jest.mock("../infra/github/utils", () => {
  const actual = jest.requireActual("../infra/github/utils");
  return {
    ...actual,
    fetchGitHub: (...args: unknown[]) => mockFetchGitHub(...args),
  };
});

function okJson(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

describe("gitDataApi binary sync payload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGitHubToken.mockResolvedValue("ghp_test_token");
  });

  it("writes base64: binary files via git blob API and references sha in tree", async () => {
    mockFetchGitHub
      .mockResolvedValueOnce(okJson({ commit: { sha: "base-commit" } }))
      .mockResolvedValueOnce(okJson({ tree: { sha: "base-tree" } }))
      .mockResolvedValueOnce(okJson({ sha: "binary-blob-sha" }))
      .mockResolvedValueOnce(okJson({ sha: "new-tree" }))
      .mockResolvedValueOnce(okJson({ sha: "new-commit" }))
      .mockResolvedValueOnce(okJson({}));

    await pushFilesToRepoAdvanced("owner", "repo", [
      { path: "assets/icon.png", content: "base64:QUJD" },
    ], { branch: "main", message: "sync" });

    const blobCall = mockFetchGitHub.mock.calls.find(([url]: [string]) => String(url).includes("/git/blobs"));
    expect(blobCall).toBeTruthy();
    const blobBody = JSON.parse(String((blobCall?.[1] as RequestInit | undefined)?.body ?? "{}"));
    expect(blobBody).toEqual({ content: "QUJD", encoding: "base64" });

    const treeCall = mockFetchGitHub.mock.calls.find(([url]: [string]) => String(url).includes("/git/trees"));
    expect(treeCall).toBeTruthy();
    const treeBody = JSON.parse(String((treeCall?.[1] as RequestInit | undefined)?.body ?? "{}"));
    expect(treeBody.tree).toEqual([
      { path: "assets/icon.png", mode: "100644", type: "blob", sha: "binary-blob-sha" },
    ]);
  });

  it("fails closed when base64: content is provided on non-binary path", async () => {
    mockFetchGitHub
      .mockResolvedValueOnce(okJson({ commit: { sha: "base-commit" } }))
      .mockResolvedValueOnce(okJson({ tree: { sha: "base-tree" } }));

    await expect(
      pushFilesToRepoAdvanced("owner", "repo", [{ path: "README.md", content: "base64:QUJD" }], {
        branch: "main",
      }),
    ).rejects.toThrow(/Nicht-Binärpfad/);

    expect(mockFetchGitHub.mock.calls.some(([url]: [string]) => String(url).includes("/git/blobs"))).toBe(false);
  });
});
