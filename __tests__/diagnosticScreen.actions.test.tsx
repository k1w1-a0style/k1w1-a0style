import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import DiagnosticScreen from "../screens/DiagnosticScreen";

const mockRunDiagnostics = jest.fn();
const mockSmartFix = jest.fn();
const mockSetReportVisible = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), setParams: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({
    projectData: { id: "p1", name: "demo", files: [] },
    updateProjectFiles: jest.fn(),
    replaceProjectFiles: jest.fn(),
    setPreferredBuildProfile: jest.fn(),
  }),
}));

jest.mock("../screens/DiagnosticScreen/hooks/useDiagnosticScreen", () => ({
  useDiagnosticScreen: () => ({
    headerStats: { name: "demo", mode: "preview", profileLabel: "preview" },
    toast: { message: "", anim: undefined },
    busy: false,
    running: false,
    previewVisible: false,
    setPreviewVisible: jest.fn(),
    previewLabel: "",
    previewEntries: [],
    issueList: [],
    issuesFilter: "all",
    setIssuesFilter: jest.fn(),
    recommendedMode: "preview",
    toSeverity: (s: string) => (s === "fail" ? "critical" : s === "warn" ? "warning" : "info"),
    openIssue: jest.fn(),
    runDiagnostics: mockRunDiagnostics,
    lastRunAt: null,
    counts: { fail: 1, warn: 1, pass: 1 },
    results: [{ id: "fail", title: "fail item", status: "fail", fix: { patch: { upsert: [] } } }],
    setReportVisible: mockSetReportVisible,
    fixableResults: [{ id: "fail", title: "fail item", status: "fail" }],
    smartFix: mockSmartFix,
    fixModalVisible: false,
    fixModalTitle: "",
    fixModalSubtitle: "",
    fixSteps: [],
    fixStepIndex: 0,
    fixDone: false,
    closeFixModal: jest.fn(),
    issueSheetVisible: false,
    activeIssue: null,
    activeIssueDetail: null,
    closeIssue: jest.fn(),
    openPreview: jest.fn(),
    applyIssueFix: jest.fn(),
  }),
}));

describe("DiagnosticScreen actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("wires Prüfen, Auto-Fix und Bericht to their screen actions", () => {
    const screen = render(<DiagnosticScreen />);

    fireEvent.press(screen.getByTestId("diagnostic-run-button"));
    fireEvent.press(screen.getByTestId("diagnostic-auto-fix-button"));
    fireEvent.press(screen.getByTestId("diagnostic-report-button"));

    expect(mockRunDiagnostics).toHaveBeenCalledTimes(1);
    expect(mockSmartFix).toHaveBeenCalledTimes(1);
    expect(mockSetReportVisible).toHaveBeenCalledWith(true);
  });
});