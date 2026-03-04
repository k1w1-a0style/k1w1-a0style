import React from "react";
import { render } from "@testing-library/react-native";

import DiagnosticScreen from "../screens/DiagnosticScreen";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), setParams: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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
      { id: "fail", title: "fail item", status: "fail" },
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
    expect(titles).toEqual(["fail item", "warn item", "pass item"]);
  });
});
