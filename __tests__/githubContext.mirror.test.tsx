import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor } from "@testing-library/react-native";

import { GitHubProvider, useGitHub } from "../contexts/GitHubContext";
import { GITHUB_STORAGE_KEYS } from "../shared/constants/github";

let mockProjectData: { linkedRepo?: string; linkedBranch?: string } = {};

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({ projectData: mockProjectData }),
}));

describe("GitHubContext mirror contract", () => {
  beforeEach(() => {
    mockProjectData = {};
    const storage = AsyncStorage as typeof AsyncStorage & {
      __resetMockStorage?: () => void;
    };
    storage.__resetMockStorage?.();
    jest.clearAllMocks();
  });

  it("mirrors linked repo and branch once without redundant rewrite passes on rerender", async () => {
    mockProjectData = {
      linkedRepo: "owner/repo",
      linkedBranch: "main",
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GitHubProvider>{children}</GitHubProvider>
    );

    const { result, rerender } = renderHook(() => useGitHub(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeRepo).toBe("owner/repo");
      expect(result.current.activeBranch).toBe("main");
    });

    const repoWritesAfterMirror = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
      ([key]) => key === GITHUB_STORAGE_KEYS.ACTIVE_REPO,
    ).length;
    const branchWritesAfterMirror = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
      ([key]) => key === GITHUB_STORAGE_KEYS.ACTIVE_BRANCH,
    ).length;

    rerender(undefined);

    await waitFor(() => {
      expect(result.current.activeRepo).toBe("owner/repo");
      expect(result.current.activeBranch).toBe("main");
    });

    expect(
      (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
        ([key]) => key === GITHUB_STORAGE_KEYS.ACTIVE_REPO,
      ),
    ).toHaveLength(repoWritesAfterMirror);
    expect(
      (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
        ([key]) => key === GITHUB_STORAGE_KEYS.ACTIVE_BRANCH,
      ),
    ).toHaveLength(branchWritesAfterMirror);
  });
});
