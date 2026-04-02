import { createOrUpdateFile, getRepoFileText, listRepoBlobEntries } from "../infra/github/files";

jest.mock("../infra/github/tokenStore", () => ({
  getGitHubToken: jest.fn(async () => "gh-token"),
}));

jest.mock("../infra/github/rateLimit", () => ({
  githubLimiter: { checkLimit: jest.fn(async () => undefined) },
}));

jest.mock("../infra/github/repos", () => ({
  getDefaultBranch: jest.fn(async () => "main"),
}));

jest.mock("../infra/github/utils", () => {
  const actual = jest.requireActual("../infra/github/utils");
  return {
    ...actual,
    fetchGitHub: jest.fn(),
  };
});

const { fetchGitHub: mockFetchGitHub } = jest.requireMock("../infra/github/utils") as {
  fetchGitHub: jest.Mock;
};
const { getDefaultBranch: mockGetDefaultBranch } = jest.requireMock("../infra/github/repos") as {
  getDefaultBranch: jest.Mock;
};

type ResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

const response = (overrides: Partial<ResponseLike>): ResponseLike => ({
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => "",
  ...overrides,
});

describe("infra/github/files contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getRepoFileText fails safely for incomplete content API responses", async () => {
    mockFetchGitHub.mockResolvedValueOnce(
      response({
        ok: true,
        json: async () => ({ path: "README.md", encoding: "base64" }),
      }),
    );

    await expect(
      getRepoFileText({ owner: "o", repo: "r", path: "README.md" }),
    ).rejects.toThrow("Unsupported file response (not base64 content).");
  });

  test("createOrUpdateFile keeps fallback error text when response payload has no message", async () => {
    mockFetchGitHub
      .mockResolvedValueOnce(
        response({
          ok: false,
          status: 404,
        }),
      )
      .mockResolvedValueOnce(
        response({
          ok: false,
          status: 500,
          json: async () => ({ reason: "missing-message-field" }),
        }),
      );

    await expect(
      createOrUpdateFile("o", "r", "README.md", "hi", "msg", "main"),
    ).rejects.toThrow("create/update file failed: README.md");
  });

  test("createOrUpdateFile fails closed when branch is missing", async () => {
    await expect(
      createOrUpdateFile("o", "r", "README.md", "hi", "msg"),
    ).rejects.toThrow("Explicit branch/ref is required.");
  });

  test("listRepoBlobEntries does not fallback to main when default branch metadata is missing", async () => {
    mockGetDefaultBranch.mockResolvedValueOnce("   ");

    await expect(
      listRepoBlobEntries({ owner: "o", repo: "r" }),
    ).rejects.toThrow("Explicit branch/ref is required.");
  });
});
