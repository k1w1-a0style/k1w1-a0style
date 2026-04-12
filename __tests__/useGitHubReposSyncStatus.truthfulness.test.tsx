import { renderHook, waitFor } from "@testing-library/react-native";
import { useRef } from "react";

const mockCompareLocalFilesWithRepo = jest.fn();

jest.mock("../infra/github/githubService", () => ({
  compareLocalFilesWithRepo: (...args: unknown[]) => mockCompareLocalFilesWithRepo(...args),
}));

const { useGitHubReposSyncStatus } = require("../screens/GitHubReposScreen/hooks/useGitHubReposSyncStatus");

describe("useGitHubReposSyncStatus truthfulness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports partial checks with lower-bound semantics", async () => {
    const normalizedLocalFiles = [{ path: "App.tsx", content: "x" }];
    mockCompareLocalFilesWithRepo.mockResolvedValueOnce({
      modified: 2,
      localOnly: 1,
      remoteOnly: 4,
      remoteOnlyIsExact: false,
      remoteOnlyUnknownDueToLocalTruncation: true,
      skipped: 0,
      error: 0,
      checkedLocalFiles: 40,
      totalLocalFiles: 92,
      isPartial: true,
      countsAreLowerBounds: true,
    });

    const { result } = renderHook(() => {
      const isMountedRef = useRef(true);
      return useGitHubReposSyncStatus({
        activeRepo: "owner/repo",
        activeBranch: "main",
        normalizedLocalFiles,
        isMountedRef,
      });
    });

    await waitFor(() => expect(result.current.syncStatus.isPartial).toBe(true));
    expect(result.current.syncStatus.countsAreLowerBounds).toBe(true);
    expect(result.current.syncStatus.partialReason).toContain("Abweichungen im Teilumfang");
  });

  it("keeps full checks non-partial", async () => {
    const normalizedLocalFiles = [{ path: "App.tsx", content: "x" }];
    mockCompareLocalFilesWithRepo.mockResolvedValueOnce({
      modified: 0,
      localOnly: 0,
      remoteOnly: 0,
      remoteOnlyIsExact: true,
      remoteOnlyUnknownDueToLocalTruncation: false,
      skipped: 0,
      error: 0,
      checkedLocalFiles: 9,
      totalLocalFiles: 9,
      isPartial: false,
      countsAreLowerBounds: false,
    });

    const { result } = renderHook(() => {
      const isMountedRef = useRef(true);
      return useGitHubReposSyncStatus({
        activeRepo: "owner/repo",
        activeBranch: "main",
        normalizedLocalFiles,
        isMountedRef,
      });
    });

    await waitFor(() => expect(result.current.syncStatus.checking).toBe(false));
    expect(result.current.syncStatus.isPartial).toBe(false);
    expect(result.current.syncStatus.countsAreLowerBounds).toBe(false);
    expect(result.current.syncStatus.partialReason).toBeNull();
  });
});
