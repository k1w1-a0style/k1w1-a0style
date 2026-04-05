import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useGitHubReposScreenUiState } from "../screens/GitHubReposScreen/hooks/useGitHubReposScreenUiState";
import { autoSyncRepoSecrets } from "../lib/autoSyncRepoSecrets";

jest.mock("../lib/autoSyncRepoSecrets", () => ({
  autoSyncRepoSecrets: jest.fn(async () => ({ updated: ["A"] })),
}));

describe("useGitHubReposScreenUiState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts with expected default UI state", () => {
    const { result } = renderHook(() => useGitHubReposScreenUiState({ activeRepo: null }));

    expect(result.current.showRepoList).toBe(true);
    expect(result.current.showNewRepo).toBe(false);
    expect(result.current.showRenameRepo).toBe(false);
    expect(result.current.filterType).toBe("all");
    expect(result.current.newRepoPrivate).toBe(true);
    expect(result.current.isSyncingSecrets).toBe(false);
  });

  it("blocks secret sync when no active repo is selected", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const { result } = renderHook(() => useGitHubReposScreenUiState({ activeRepo: null }));

    await act(async () => {
      await result.current.handleSyncSecrets();
    });

    expect(autoSyncRepoSecrets).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("⚠️", "Kein Repo ausgewählt.");
    alertSpy.mockRestore();
  });
});
