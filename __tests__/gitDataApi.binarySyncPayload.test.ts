import { applyRepoFilePatchAtomic, pushFilesToRepoAdvanced } from "../infra/github/files";

jest.mock("../infra/github/tokenStore", () => ({
  getGitHubToken: jest.fn(async () => "ghp_test_token"),
}));

jest.mock("../infra/github/repos", () => ({
  getDefaultBranch: jest.fn(async () => "main"),
}));

jest.mock("../infra/github/rateLimit", () => ({
  githubLimiter: {
    checkLimit: jest.fn(async () => undefined),
  },
}));

type MockResponseInit = {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
};

const createResponse = ({ ok, status = 200, json, text = "" }: MockResponseInit): Response =>
  ({
    ok,
    status,
    json: async () => json,
    text: async () => text,
  }) as Response;

describe("gitDataApi binary sync payload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  it("pushFilesToRepoAdvanced creates binary blobs from base64: files and uses blob sha in tree", async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>)
      .mockResolvedValueOnce(createResponse({ ok: true, json: { commit: { sha: "base-commit" } } }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: { tree: { sha: "base-tree" } } }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: { sha: "blob-sha-icon" } }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: { sha: "new-tree" } }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: { sha: "new-commit" } }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: {} }));

    await pushFilesToRepoAdvanced("owner", "repo", [{ path: "assets/icon.png", content: "base64:QUJD" }]);

    const blobCall = (global.fetch as jest.Mock).mock.calls[2];
    expect(blobCall?.[0]).toContain("/repos/owner/repo/git/blobs");
    expect(JSON.parse(String((blobCall?.[1] as RequestInit | undefined)?.body ?? "{}"))).toEqual({
      content: "QUJD",
      encoding: "base64",
    });

    const treeCall = (global.fetch as jest.Mock).mock.calls[3];
    expect(JSON.parse(String((treeCall?.[1] as RequestInit | undefined)?.body ?? "{}"))).toMatchObject({
      tree: [
        {
          path: "assets/icon.png",
          mode: "100644",
          type: "blob",
          sha: "blob-sha-icon",
        },
      ],
    });
  });

  it("applyRepoFilePatchAtomic fails closed for invalid base64 payloads", async () => {
    await expect(
      applyRepoFilePatchAtomic(
        "owner",
        "repo",
        {
          upsert: [{ path: "assets/icon.png", content: "base64:not-valid***" }],
        },
        { branch: "main" },
      ),
    ).rejects.toThrow("Ungültiges base64:-Format für Binärdatei: assets/icon.png");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fails closed when too many repo operations are pushed in one batch", async () => {
    const files = Array.from({ length: 201 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      content: `export const value${index} = ${index};`,
    }));

    await expect(pushFilesToRepoAdvanced("owner", "repo", files)).rejects.toThrow(
      "Zu viele Repo-Operationen für pushFilesToRepoAdvanced: 201 > 200. Bitte in kleineren Batches synchronisieren.",
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
