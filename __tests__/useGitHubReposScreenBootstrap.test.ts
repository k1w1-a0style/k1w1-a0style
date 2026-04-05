import { act, renderHook } from "@testing-library/react-native";

import { useGitHubReposScreenBootstrap } from "../screens/GitHubReposScreen/hooks/useGitHubReposScreenBootstrap";

const mockGetGitHubToken = jest.fn(async () => "ghp_test");
const mockGetGitHubUser = jest.fn(async () => ({ login: "operator" }));
const mockGetItem = jest.fn(async (_key?: string) => "11111111-1111-1111-1111-111111111111");

jest.mock("../infra/github/githubService", () => ({
  getGitHubToken: () => mockGetGitHubToken(),
}));

jest.mock("../infra/github/user", () => ({
  getGitHubUser: () => mockGetGitHubUser(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
  },
}));

describe("useGitHubReposScreenBootstrap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads token, user login and eas project id on bootstrap", async () => {
    const { result } = renderHook(() => useGitHubReposScreenBootstrap());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.token).toBe("ghp_test");
    expect(result.current.userLogin).toBe("operator");
    expect(result.current.easProjectId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.current.tokenError).toBeNull();
    expect(mockGetGitHubToken).toHaveBeenCalledTimes(1);
    expect(mockGetGitHubUser).toHaveBeenCalledTimes(1);
  });
});
