import { act, renderHook } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";

import { useEnhancedBuildScreen } from "../screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen";

const mockStartBuild = jest.fn(async () => {});
const mockGetWorkflowRuns = jest.fn(async () => ({ workflow_runs: [] }));

const projectState: {
  linkedRepo: string;
  linkedBranch: string;
  preferredBuildProfile: "preview" | "production" | "development";
} = {
  linkedRepo: "o/r",
  linkedBranch: "main",
  preferredBuildProfile: "preview",
};

const preconditionsState: {
  hasTokens: boolean;
  hasSigningKey: boolean;
  hasDiagOk: boolean;
  hasCiLiteOk: boolean;
  hasProjectFiles: boolean;
  diagnosticReason: string | null;
} = {
  hasTokens: true,
  hasSigningKey: true,
  hasDiagOk: true,
  hasCiLiteOk: true,
  hasProjectFiles: true,
  diagnosticReason: null,
};

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({
    projectData: {
      linkedRepo: projectState.linkedRepo,
      linkedBranch: projectState.linkedBranch,
      preferredBuildProfile: projectState.preferredBuildProfile,
      files: [{ path: "App.tsx", content: "export default 1;" }],
    },
    startBuild: mockStartBuild,
    currentBuild: {
      status: "idle",
      runId: null,
      githubRepo: projectState.linkedRepo,
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
    hasTokens: preconditionsState.hasTokens,
    hasWorkflowAdminKey: true,
    workflowAdminKeyReason: null,
    hasOperatorJwt: true,
    operatorJwtReason: null,
    hasSigningKey: preconditionsState.hasSigningKey,
    signingKeyReason: null,
    hasDiagOk: preconditionsState.hasDiagOk,
    hasCiLiteOk: preconditionsState.hasCiLiteOk,
    diagnosticReason: preconditionsState.diagnosticReason,
    ciLiteReason: null,
    repoSyncState: "in_sync",
    repoSyncReason: null,
    hasProjectFiles: preconditionsState.hasProjectFiles,
    projectFilesReason: null,
    refreshPreconditions: jest.fn(async () => {}),
  }),
}));

describe("useEnhancedBuildScreen integration error paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectState.linkedRepo = "o/r";
    projectState.linkedBranch = "main";
    preconditionsState.hasTokens = true;
    preconditionsState.hasSigningKey = true;
    preconditionsState.hasDiagOk = true;
    preconditionsState.hasCiLiteOk = true;
    preconditionsState.hasProjectFiles = true;
    preconditionsState.diagnosticReason = null;

    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("blocks start and shows readiness alert when diagnostic is not green", async () => {
    preconditionsState.hasDiagOk = false;
    preconditionsState.diagnosticReason = "Diagnostik fehlt";

    const { result } = renderHook(() => useEnhancedBuildScreen());

    await act(async () => {
      await result.current.onStartBuild();
    });

    expect(mockStartBuild).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Nicht bereit", "Diagnostik fehlt");
  });

  test("shows invalid repo alert on fetchRuns when repo selection is missing", async () => {
    projectState.linkedRepo = "";

    const { result } = renderHook(() => useEnhancedBuildScreen());

    await act(async () => {
      await result.current.fetchRuns();
    });

    expect(mockGetWorkflowRuns).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Ungültiges Repo", expect.any(String));
  });

  test("shows URL-open error when run URL cannot be opened", async () => {
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(false);
    const { result } = renderHook(() => useEnhancedBuildScreen());

    await act(async () => {
      await result.current.openRun("https://example.com");
    });

    expect(Alert.alert).toHaveBeenCalledWith("Fehler", "URL kann nicht geöffnet werden.");
  });
});
