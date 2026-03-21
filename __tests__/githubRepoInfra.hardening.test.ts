import { act, renderHook } from "@testing-library/react-native";

import { pushFilesToRepoAdvanced } from "../infra/github/files";
import { normalizeRepoPath } from "../infra/github/utils";
import { MAX_PULL_TEXT_FILES, useGitHubRepos } from "../hooks/useGitHubRepos";
import { fetchWithBackoff } from "../lib/retryWithBackoff";

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

jest.mock("../lib/retryWithBackoff", () => ({
  fetchWithBackoff: jest.fn(),
}));

jest.mock("../infra/github/githubService", () => ({
  getBranches: jest.fn(async () => []),
  getAllWorkflowRuns: jest.fn(async () => []),
  getDefaultBranch: jest.fn(async () => "main"),
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

describe("GitHub repo infra hardening", () => {
  const fetchWithBackoffMock = fetchWithBackoff as jest.MockedFunction<typeof fetchWithBackoff>;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  it("blocks traversal segments in normalizeRepoPath while preserving normal repo paths", () => {
    expect(normalizeRepoPath("./src\\App.tsx")).toBe("src/App.tsx");
    expect(normalizeRepoPath("docs/readme.md")).toBe("docs/readme.md");
    expect(normalizeRepoPath("../secret.txt")).toBe("");
    expect(normalizeRepoPath("src/../secret.txt")).toBe("");
  });

  it("rejects traversal-like push paths before any GitHub write happens", async () => {
    await expect(
      pushFilesToRepoAdvanced("owner", "repo", [{ path: "../secret.txt", content: "x" }]),
    ).rejects.toThrow("Ungültiger Repo-Pfad: ../secret.txt");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("keeps normal push normalization and unmanaged-workflow guard behavior", async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>)
      .mockResolvedValueOnce(createResponse({ ok: true, json: { commit: { sha: "base-commit" } } }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: { tree: { sha: "base-tree" } } }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: { sha: "new-tree" } }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: { sha: "new-commit" } }))
      .mockResolvedValueOnce(createResponse({ ok: true, json: {} }));

    await pushFilesToRepoAdvanced("owner", "repo", [
      { path: "./src\\App.tsx", content: "export default 1;" },
      { path: ".github/workflows/custom.yml", content: "name: custom" },
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(5);

    const treeCall = (global.fetch as jest.Mock).mock.calls[2];
    const treeBody = JSON.parse(String((treeCall?.[1] as RequestInit | undefined)?.body ?? "{}"));

    expect(treeBody.tree).toEqual([
      {
        path: "src/App.tsx",
        mode: "100644",
        type: "blob",
        content: "export default 1;",
      },
    ]);
  });

  it("aborts pulls honestly when a repo exceeds the hard text-file cap", async () => {
    const callbacks = {
      onPullError: jest.fn(),
    };

    fetchWithBackoffMock
      .mockResolvedValueOnce(createResponse({ ok: true, json: { default_branch: "main" } }))
      .mockResolvedValueOnce(
        createResponse({
          ok: true,
          json: {
            tree: Array.from({ length: MAX_PULL_TEXT_FILES + 1 }, (_, index) => ({
              type: "blob",
              path: `src/file-${index}.ts`,
              sha: `sha-${index}`,
            })),
          },
        }),
      );

    const { result } = renderHook(() => useGitHubRepos("ghp_test_token", callbacks));
    const progress = jest.fn();

    let pulled: Awaited<ReturnType<typeof result.current.pullFromRepo>> = null;
    await act(async () => {
      pulled = await result.current.pullFromRepo("owner", "repo", progress);
    });

    expect(pulled).toBeNull();
    expect(callbacks.onPullError).toHaveBeenCalledWith(
      expect.stringContaining(`Limit ist ${MAX_PULL_TEXT_FILES}`),
    );
    expect(fetchWithBackoffMock).toHaveBeenCalledTimes(2);
    expect(fetchWithBackoffMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/graphql"),
      expect.anything(),
    );
  });

  it("keeps normal pull semantics for small repos", async () => {
    fetchWithBackoffMock
      .mockResolvedValueOnce(createResponse({ ok: true, json: { default_branch: "main" } }))
      .mockResolvedValueOnce(
        createResponse({
          ok: true,
          json: {
            tree: [
              { type: "blob", path: "src/App.tsx", sha: "sha-app" },
              { type: "blob", path: "assets/logo.png", sha: "sha-logo" },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: true,
          json: {
            data: {
              repository: {
                f0: {
                  isBinary: false,
                  text: "export default function App() { return null; }",
                },
              },
            },
          },
        }),
      );

    const callbacks = {
      onPullError: jest.fn(),
      onPullNoFiles: jest.fn(),
    };

    const { result } = renderHook(() => useGitHubRepos("ghp_test_token", callbacks));

    let pulled: Awaited<ReturnType<typeof result.current.pullFromRepo>> = null;
    await act(async () => {
      pulled = await result.current.pullFromRepo("owner", "repo");
    });

    expect(pulled).toEqual([
      { path: "src/App.tsx", content: "export default function App() { return null; }" },
    ]);
    expect(callbacks.onPullError).not.toHaveBeenCalled();
    expect(callbacks.onPullNoFiles).not.toHaveBeenCalled();
  });
});
