import { act, renderHook, waitFor } from "@testing-library/react-native";

jest.mock("../screens/DiagnosticScreen/hooks/useDiagnosticCiAutofix", () => ({
  useDiagnosticCiAutofix: () => ({
    ciFixing: false,
    ciFixLog: [],
    runCiAutofix: jest.fn(),
  }),
}));

jest.mock("../components/diagnostics/useInlineToast", () => ({
  useInlineToast: () => ({ show: jest.fn() }),
}));

jest.mock("../screens/DiagnosticScreen/hooks/useDiagnosticPreferences", () => ({
  useDiagnosticPreferences: () => ({
    modeAdvanced: false,
    setModeAdvanced: jest.fn(),
    modesAll: false,
    setModesAll: jest.fn(),
    selectedModes: [],
    setSelectedModes: jest.fn(),
    includeLocalChecks: true,
    setIncludeLocalChecks: jest.fn(),
    includePipelineChecks: true,
    setIncludePipelineChecks: jest.fn(),
    syncFixesToGitHub: false,
    setSyncFixesToGitHub: jest.fn(),
    rerunAfterFix: false,
    setRerunAfterFix: jest.fn(),
    autoFixIncludeWarn: false,
    setAutoFixIncludeWarn: jest.fn(),
    autoFixScope: "visible",
    setAutoFixScope: jest.fn(),
  }),
}));

jest.mock("../screens/DiagnosticScreen/hooks/useDiagnosticUpload", () => ({
  useDiagnosticUpload: () => ({
    uploadBusyRef: { current: false },
    uploadBusy: false,
    uploadCooldownUntil: null,
    setUploadCooldownUntil: jest.fn(),
    setCooldownNow: jest.fn(),
    uploadCooldownLeftSec: 0,
    getOrCreateUploadClientRequestId: jest.fn(),
    resetUploadClientRequestId: jest.fn(),
    upload: jest.fn(),
    copyReport: jest.fn(),
  }),
}));

jest.mock("../screens/DiagnosticScreen/hooks/useDiagnosticSelection", () => ({
  useDiagnosticSelection: () => {
    const React = require("react");
    const [selected, setSelected] = React.useState<Record<string, boolean>>({});
    return {
      selected,
      setSelected,
      selectedCount: Object.keys(selected).length,
      clearSelection: () => setSelected({}),
    };
  },
}));

jest.mock("../screens/DiagnosticScreen/hooks/useDiagnosticIssueFiltering", () => ({
  useDiagnosticIssueFiltering: (results: unknown[]) => ({
    issuesFilter: "all",
    setIssuesFilter: jest.fn(),
    visibleResults: results,
  }),
}));

jest.mock("../screens/DiagnosticScreen/hooks/useDiagnosticFixRunner", () => ({
  useDiagnosticFixRunner: () => ({
    history: [],
    previewVisible: false,
    setPreviewVisible: jest.fn(),
    previewLabel: "",
    previewEntries: [],
    setPreviewLabel: jest.fn(),
    setPreviewEntries: jest.fn(),
    applyBusy: false,
    fixModalVisible: false,
    fixModalTitle: "",
    fixModalSubtitle: undefined,
    fixSteps: [],
    fixStepIndex: 0,
    fixDone: false,
    closeFixModal: jest.fn(),
    openPreview: jest.fn(),
    applyPatch: jest.fn(),
    undoLast: jest.fn(),
    undoAll: jest.fn(),
    applySingle: jest.fn(),
    autoFix: jest.fn(),
    applySelected: jest.fn(),
    smartFix: jest.fn(),
    applyIssueFix: jest.fn(),
    applyFixList: jest.fn(),
  }),
}));

jest.mock("../screens/DiagnosticScreen/hooks/diagnosticRunners", () => ({
  ORDER: { fail: 0, warn: 1, pass: 2 },
  runLocalChecks: jest.fn(),
  runPipelineChecks: jest.fn(),
}));

jest.mock("../lib/diagnostics/fixResultContract", () => ({
  getDiagnosticFixOffer: () => ({
    status: "advisory_only",
    actionLabel: "Advisory",
    previewAvailable: false,
  }),
}));

import { useDiagnosticScreen } from "../screens/DiagnosticScreen/hooks/useDiagnosticScreen";

describe("useDiagnosticScreen scope invalidation", () => {
  it("clears stale results and selection when repo/branch scope changes", async () => {
    const { result, rerender } = renderHook(
      (props: { linkedRepo: string; linkedBranch: string }) =>
        useDiagnosticScreen({
          projectData: { name: "P", files: [], preferredBuildProfile: "preview" } as never,
          linkedRepo: props.linkedRepo,
          linkedBranch: props.linkedBranch,
          updateProjectFiles: jest.fn(async () => undefined),
          deleteFile: jest.fn(async () => undefined),
        }),
      {
        initialProps: { linkedRepo: "owner/repo-a", linkedBranch: "main" },
      },
    );

    await act(async () => {
      result.current.setResults([
        { id: "repo.eas", title: "x", message: "y", status: "fail" } as never,
      ]);
      result.current.setSelected({ "repo.eas": true });
      result.current.setReportVisible(true);
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.selected).toEqual({ "repo.eas": true });
    expect(result.current.reportVisible).toBe(true);

    rerender({ linkedRepo: "owner/repo-b", linkedBranch: "develop" });

    await waitFor(() => {
      expect(result.current.results).toEqual([]);
      expect(result.current.selected).toEqual({});
      expect(result.current.reportVisible).toBe(false);
    });
  });
});
