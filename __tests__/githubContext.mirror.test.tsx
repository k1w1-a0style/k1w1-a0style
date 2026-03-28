import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor } from "@testing-library/react-native";

import { GitHubProvider, useGitHub } from "../contexts/GitHubContext";

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

  it("exposes linked repo/branch as active selection without writing legacy active storage keys", async () => {
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

    rerender(undefined);

    await waitFor(() => {
      expect(result.current.activeRepo).toBe("owner/repo");
      expect(result.current.activeBranch).toBe("main");
    });

    const setItemKeys = (AsyncStorage.setItem as jest.Mock).mock.calls.map(([key]) => key);
    expect(setItemKeys).not.toContain("k1w1_github_active_repo");
    expect(setItemKeys).not.toContain("k1w1_github_active_branch");
  });
});
