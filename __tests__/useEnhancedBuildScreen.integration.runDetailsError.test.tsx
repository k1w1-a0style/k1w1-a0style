import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: () => undefined,
}));

jest.mock("../screens/EnhancedBuildScreen/hooks/buildScreenHelpers", () => {
  const actual = jest.requireActual("../screens/EnhancedBuildScreen/hooks/buildScreenHelpers");
  return {
    ...actual,
    fetchRunDetailsBundle: jest.fn(async () => {
      throw new Error("run details boom");
    }),
  };
});

import { useEnhancedBuildScreen } from "../screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen";
import type { WorkflowRun } from "../screens/EnhancedBuildScreen/types";

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

describe("useEnhancedBuildScreen integration run detail error path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("surfaces run detail fetch errors in runDetailError state", async () => {
    const { result } = renderHook(() => useEnhancedBuildScreen());

    await act(async () => {
      await result.current.openRunDetails({
        id: 321,
        html_url: "https://github.com/o/r/actions/runs/321",
      } as WorkflowRun);
    });

    await waitFor(() => {
      expect(result.current.runDetailVisible).toBe(true);
      expect(result.current.runDetailLoading).toBe(false);
      expect(result.current.runDetailError).toContain("run details boom");
    });
  });

  test("keeps error surfaced when refreshing details for an already selected run", async () => {
    const { result } = renderHook(() => useEnhancedBuildScreen());

    await act(async () => {
      await result.current.openRunDetails({
        id: 654,
        html_url: "https://github.com/o/r/actions/runs/654",
      } as WorkflowRun);
    });

    await act(async () => {
      await result.current.refreshRunDetails();
    });

    await waitFor(() => {
      expect(result.current.selectedRun?.id).toBe(654);
      expect(result.current.runDetailVisible).toBe(true);
      expect(result.current.runDetailLoading).toBe(false);
      expect(result.current.runDetailError).toContain("run details boom");
    });
  });
});
