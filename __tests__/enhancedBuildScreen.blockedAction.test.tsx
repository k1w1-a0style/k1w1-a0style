import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import EnhancedBuildScreen from "../screens/EnhancedBuildScreen";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("../screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen", () => ({
  useEnhancedBuildScreen: () => ({
    checklistItems: [],
    buildProfile: "preview",
    repoFullName: "owner/repo",
    branchName: "main",
    hasStartBuild: true,
    startBuildFn: jest.fn(),
    projectData: { name: "Demo App" },
    currentBuild: null,
    onSelectBuildProfile: jest.fn(),
    buildBlockedAction: {
      title: "Repo fehlt",
      detail: "Bitte zuerst ein Repo auswählen.",
      ctaLabel: "Repo wählen",
      screen: "GitHubRepos",
      params: { source: "build" },
    },
    canStartBuildUi: false,
    buildBlockedReason: "Repo fehlt",
    refreshing: false,
    onRefresh: jest.fn(),
    status: "idle",
    statusLabel: "Idle",
    message: "",
    jobId: null,
    etaMs: null,
    formatDuration: jest.fn(),
    progress: 0,
    buildLoading: false,
    onStartBuild: jest.fn(),
    openRun: jest.fn(),
    runsEmptyStateText: "",
    historyLoading: false,
    stats: null,
    history: [],
    clearHistory: jest.fn(),
    deleteHistoryEntry: jest.fn(),
    historyFilter: "all",
    setHistoryFilter: jest.fn(),
    shouldLoadLogs: false,
    githubRepoForLogs: null,
    logsWaitingReason: "",
    logsLoading: false,
    logsError: null,
    logs: [],
    analyses: [],
    workflowRun: null,
    logModalVisible: false,
    setLogModalVisible: jest.fn(),
    logLines: [],
    refreshLogs: jest.fn(),
    autoRefreshEnabled: false,
    setAutoRefreshEnabled: jest.fn(),
    runDetailVisible: false,
    setRunDetailVisible: jest.fn(),
    selectedRun: null,
    runDetails: null,
    runJobs: [],
    runDetailLoading: false,
    runDetailError: null,
    refreshRunDetails: jest.fn(),
    runMatch: null,
  }),
}));

jest.mock("../screens/EnhancedBuildScreen/hooks/useOneClickDeploy", () => ({
  useOneClickDeploy: () => ({
    steps: [],
    isDeploying: false,
    deployDone: false,
    autoSyncSecrets: false,
    toggleAutoSyncSecrets: jest.fn(),
    runDeploy: jest.fn(),
    resetSteps: jest.fn(),
    abort: jest.fn(),
  }),
}));

jest.mock("../screens/EnhancedBuildScreen/components/ChecklistSection", () => ({
  ChecklistSection: () => null,
}));
jest.mock("../screens/EnhancedBuildScreen/components/BuildProgressSection", () => ({
  BuildProgressSection: () => null,
}));
jest.mock("../screens/EnhancedBuildScreen/components/BuildStatusSection", () => ({
  BuildStatusSection: () => null,
}));
jest.mock("../screens/EnhancedBuildScreen/components/BuildHistorySection", () => ({
  BuildHistorySection: () => null,
}));
jest.mock("../screens/EnhancedBuildScreen/components/WorkflowRunDetailModal", () => ({
  WorkflowRunDetailModal: () => null,
}));
jest.mock("../screens/EnhancedBuildScreen/components/RepoProfileSection", () => ({
  BuildModeDropdown: () => null,
  RepoInfoBadge: () => null,
}));
jest.mock("../screens/EnhancedBuildScreen/components/OneClickDeployCard", () => ({
  OneClickDeployCard: () => null,
}));
jest.mock("../screens/EnhancedBuildScreen/components/LogsAnalysisSection", () => ({
  LogsAnalysisSection: () => null,
}));
jest.mock("../components/BuildLogsModal", () => ({
  BuildLogsModal: () => null,
}));

describe("EnhancedBuildScreen blocked action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("navigates to the recommended recovery screen from the blocked CTA", () => {
    const screen = render(<EnhancedBuildScreen />);

    fireEvent.press(screen.getByTestId("enhanced-build-blocked-cta-button"));

    expect(mockNavigate).toHaveBeenCalledWith("GitHubRepos", { source: "build" });
  });
});