import { pushFilesToRepoAdvanced } from "../infra/github/files";

const mockGetGitHubToken = jest.fn(async () => "ghp_test_token");
const mockGetDefaultBranch = jest.fn(async (_owner: string, _repo: string) => "main");

jest.mock("../infra/github/tokenStore", () => ({
  getGitHubToken: () => mockGetGitHubToken(),
}));

jest.mock("../infra/github/repos", () => ({
  getDefaultBranch: (owner: string, repo: string) => mockGetDefaultBranch(owner, repo),
}));

jest.mock("../infra/github/rateLimit", () => ({
  githubLimiter: {
    checkLimit: jest.fn(async () => undefined),
  },
}));

describe("gitDataApi batch guard ordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  it("rejects >200 files before branch resolution/network side effects", async () => {
    const files = Array.from({ length: 201 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      content: `export const value${index} = ${index};`,
    }));

    await expect(pushFilesToRepoAdvanced("owner", "repo", files)).rejects.toThrow(
      "Zu viele Repo-Operationen für pushFilesToRepoAdvanced: 201 > 200. Bitte in kleineren Batches synchronisieren.",
    );

    expect(mockGetDefaultBranch).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
