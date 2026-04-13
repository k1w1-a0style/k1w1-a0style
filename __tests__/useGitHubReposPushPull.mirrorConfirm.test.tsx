import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useGitHubReposPushPull } from "../screens/GitHubReposScreen/hooks/useGitHubReposPushPull";

const mockMarkRepoSyncSignature = jest.fn();

jest.mock("../lib/repoSyncOrchestration", () => ({
  markRepoSyncSignature: (...args: unknown[]) => mockMarkRepoSyncSignature(...args),
}));

describe("useGitHubReposPushPull mirror confirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("stops mirror apply strictly when destructive confirmation is canceled", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((title: string, _message?: string, buttons?: any) => {
      if (title.includes("Mirror löscht")) {
        const cancel = (buttons || []).find((entry: any) => entry?.style === "cancel");
        cancel?.onPress?.();
      }
    });

    const updateProjectFiles = jest.fn(async () => undefined);
    const refreshSyncStatus = jest.fn(async () => undefined);
    const pullFromRepo = jest.fn(async () => [{ path: "App.tsx", content: "remote" }]);

    const { result } = renderHook(() =>
      useGitHubReposPushPull({
        activeRepo: "owner/repo",
        activeBranch: "main",
        normalizedLocalFiles: [
          { path: "App.tsx", content: "local" },
          { path: "local-only.ts", content: "remove" },
        ],
        updateProjectFiles,
        refreshSyncStatus,
        pullFromRepo,
        withCoreFiles: (files) => files,
      }),
    );

    await act(async () => {
      await result.current.handlePull();
    });

    await waitFor(() => expect(result.current.pullPreview).not.toBeNull());

    await act(async () => {
      await result.current.applyPulledFiles("mirror");
    });

    expect(updateProjectFiles).not.toHaveBeenCalled();
    expect(mockMarkRepoSyncSignature).not.toHaveBeenCalled();
    expect(refreshSyncStatus).not.toHaveBeenCalled();
  });
});
