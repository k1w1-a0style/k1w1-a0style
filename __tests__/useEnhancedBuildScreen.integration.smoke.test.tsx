import { act, renderHook } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";

import { useEnhancedBuildScreen } from "../screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen";

const mockStartBuild = jest.fn(async () => {});
const mockGetWorkflowRuns = jest.fn(async () => ({
  workflow_runs: [
    { id: 101, html_url: "https://github.com/o/r/actions/runs/101", status: "queued" },
  ],
}));

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({
    projectData: {
      linkedRepo: "o/r",
      linkedBranch: "main",
      preferredBuildProfile: "preview",
      files: [{ path: "App.tsx", content: "export default 1;" }],
    },
    startBuild: mockStartBuild,
    currentBuild: {
      status: "idle",
      runId: null,
      message: "",
      progress: 0,
      githubRepo: "o/r",
    },
    getWorkflowRuns: mockGetWorkflowRuns,
    setPreferredBuildProfile: jest.fn(async () => {}),
  }),
}));

jest.mock("../hooks/useBuildHistory", () => ({
  useBuildHistory: () => ({
    history: [],
    isLoading: false,
    refresh: jest.fn(async () => {}),
    clearHistory: jest.fn(async () => {}),
    deleteEntry: jest.fn(async () => {}),
  }),
}));

jest.mock("../hooks/useGitHubActionsLogs", () => ({
  useGitHubActionsLogs: () => ({
    logs: [],
    workflowRun: null,
    isLoading: false,
    error: null,
    refreshLogs: jest.fn(async () => {}),
  }),
}));

jest.mock("../screens/EnhancedBuildScreen/hooks/useBuildPreconditions", () => ({
  useBuildPreconditions: () => ({
    hasTokens: true,
    hasSigningKey: true,
    signingKeyReason: null,
    hasDiagOk: true,
    hasCiLiteOk: true,
    diagnosticReason: null,
    ciLiteReason: null,
    repoSyncState: "in_sync",
    repoSyncReason: null,
    hasProjectFiles: true,
    projectFilesReason: null,
    refreshPreconditions: jest.fn(async () => {}),
  }),
}));

describe("useEnhancedBuildScreen integration smoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("wires fetchRuns and onStartBuild through composed hook contract", async () => {
    const { result } = renderHook(() => useEnhancedBuildScreen());

    expect(result.current.repoFullName).toBe("o/r");
    expect(result.current.branchName).toBe("main");
    expect(result.current.canStartBuildUi).toBe(true);

    await act(async () => {
      await result.current.fetchRuns();
    });

    expect(mockGetWorkflowRuns).toHaveBeenCalledWith("o", "r", "k1w1-triggered-build.yml");

    await act(async () => {
      await result.current.onStartBuild();
    });

    expect(mockStartBuild).toHaveBeenCalledWith("preview");
  });
});
