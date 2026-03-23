import React from "react";
import { render } from "@testing-library/react-native";

import DiagnosticScreen from "../screens/DiagnosticScreen";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), setParams: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({
    projectData: { id: "p1", name: "demo", files: [] },
    updateProjectFiles: jest.fn(),
    deleteFile: jest.fn(),
    setPreferredBuildProfile: jest.fn(),
  }),
}));

jest.mock("../screens/DiagnosticScreen/hooks/useDiagnosticScreen", () => ({
  useDiagnosticScreen: () => ({
    headerStats: { name: "demo", profileLabel: "preview" },
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
    runDiagnostics: jest.fn(),
    lastRunAt: null,
    counts: { fail: 1, warn: 1, pass: 1 },
    results: [
      { id: "pass", title: "pass item", status: "pass" },
      { id: "warn", title: "warn item", status: "warn" },
      { id: "workflow", title: "workflow item", status: "fail", fix: { workflowDispatch: { workflowFileName: "eas-link.yml" } } },
      { id: "fail", title: "fail item", status: "fail", fix: { patch: { upsert: [] } } },
    ],
    setReportVisible: jest.fn(),
    fixableResults: [],
    smartFix: jest.fn(),
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

describe("DiagnosticScreen checklist sorting", () => {
  test("renders fail before warn before pass", () => {
    const { getAllByText } = render(<DiagnosticScreen />);
    const titles = getAllByText(/ item$/).map((node) => String(node.props.children));
    expect(titles).toEqual(["workflow item", "fail item", "warn item", "pass item"]);
  });

  test("does not show the advisory chat hint for pass items", () => {
    const { queryAllByText } = render(<DiagnosticScreen />);
    expect(queryAllByText("Im Chat verfügbar")).toHaveLength(1);
    expect(queryAllByText("Patch-Fix verfügbar")).toHaveLength(1);
    expect(queryAllByText("Workflow-Fix verfügbar")).toHaveLength(1);
  });

});
