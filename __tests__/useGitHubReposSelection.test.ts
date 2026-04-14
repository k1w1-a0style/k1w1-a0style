import { act, renderHook } from "@testing-library/react-native";

import { useGitHubReposSelection } from "../screens/GitHubReposScreen/hooks/useGitHubReposSelection";

const mockGetItem = jest.fn(async (_key?: string) => null);
const mockSetItem = jest.fn(async (_key?: string, _value?: string) => undefined);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

describe("useGitHubReposSelection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses repo payload default branch immediately without fallback fetch", async () => {
    const addRecentRepo = jest.fn();
    const setLinkedRepo = jest.fn();
    const loadDefaultBranch = jest.fn(async () => "main");

    const { result } = renderHook(() =>
      useGitHubReposSelection({
        activeRepo: "owner/repo",
        addRecentRepo,
        setLinkedRepo,
        loadDefaultBranch,
        isMountedRef: { current: true },
        setShowRenameRepo: jest.fn(),
        setShowNewRepo: jest.fn(),
        setPullProgress: jest.fn(),
      }),
    );

    await act(async () => {
      result.current.handleSelectRepo({
        id: 1,
        name: "repo",
        full_name: "owner/repo",
        private: true,
        updated_at: "2026-01-01T00:00:00Z",
        default_branch: "staging",
      });
    });

    expect(addRecentRepo).toHaveBeenCalledWith("owner/repo");
    expect(setLinkedRepo).toHaveBeenCalledWith("owner/repo", "staging");
    expect(loadDefaultBranch).not.toHaveBeenCalled();
  });

  it("fetches default branch for string selections before committing repo selection", async () => {
    const addRecentRepo = jest.fn();
    const setLinkedRepo = jest.fn();
    const loadDefaultBranch = jest.fn(async () => "release");

    const { result } = renderHook(() =>
      useGitHubReposSelection({
        activeRepo: "owner/repo",
        addRecentRepo,
        setLinkedRepo,
        loadDefaultBranch,
        isMountedRef: { current: true },
        setShowRenameRepo: jest.fn(),
        setShowNewRepo: jest.fn(),
        setPullProgress: jest.fn(),
      }),
    );

    await act(async () => {
      result.current.handleSelectRepo("owner/repo");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setLinkedRepo).toHaveBeenCalledTimes(1);
    expect(setLinkedRepo).toHaveBeenCalledWith("owner/repo", "release");
    expect(addRecentRepo).toHaveBeenCalledWith("owner/repo");
    expect(loadDefaultBranch).toHaveBeenCalledWith("owner", "repo");
  });
});
