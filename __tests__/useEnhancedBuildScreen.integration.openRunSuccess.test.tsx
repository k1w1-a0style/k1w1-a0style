import { act, renderHook } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";

import { useEnhancedBuildScreen } from "../screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen";

const mockStartBuild = jest.fn(async () => {});
const mockGetWorkflowRuns = jest.fn(async () => ({ workflow_runs: [] }));

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
      githubRepo: "o/r",
      message: "",
      progress: 0,
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
    hasWorkflowAdminKey: true,
    workflowAdminKeyReason: null,
    hasOperatorJwt: true,
    operatorJwtReason: null,
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

describe("useEnhancedBuildScreen integration openRun success", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("opens run URL when supported", async () => {
    const { result } = renderHook(() => useEnhancedBuildScreen());

    await act(async () => {
      await result.current.openRun("https://github.com/o/r/actions/runs/777");
    });

    expect(Linking.canOpenURL).toHaveBeenCalledWith("https://github.com/o/r/actions/runs/777");
    expect(Linking.openURL).toHaveBeenCalledWith("https://github.com/o/r/actions/runs/777");
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
