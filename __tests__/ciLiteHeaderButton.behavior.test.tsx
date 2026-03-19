import React from "react";
import { Animated } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import CiLiteHeaderButton from "../components/CiLiteHeaderButton";
import { WORKFLOW_CI_LITE } from "../components/CiLiteHeaderButton/types";

const mockUseProject = jest.fn();
const mockUseCiLiteWorkflow = jest.fn();
const mockUseCiLitePatch = jest.fn();
const mockUseCiLiteAnimations = jest.fn();

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

jest.mock("../components/CiLiteHeaderButton/hooks/useCiLiteWorkflow", () => ({
  useCiLiteWorkflow: () => mockUseCiLiteWorkflow(),
}));

jest.mock("../components/CiLiteHeaderButton/hooks/useCiLitePatch", () => ({
  useCiLitePatch: () => mockUseCiLitePatch(),
}));

jest.mock("../components/CiLiteHeaderButton/hooks/useCiLiteAnimations", () => ({
  useCiLiteAnimations: () => mockUseCiLiteAnimations(),
}));

describe("CiLiteHeaderButton behavior", () => {
  const setVisible = jest.fn();
  const dispatchWorkflow = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseProject.mockReturnValue({
      addChatMessage: jest.fn(),
    });

    mockUseCiLitePatch.mockReturnValue({
      patchPanelOpen: false,
      patchText: "",
      setPatchText: jest.fn(),
      patchBusy: false,
      patchInfo: null,
      pastePatchFromClipboard: jest.fn(),
      validatePatchAndShow: jest.fn(),
      applyPatchFromText: jest.fn(),
      setPatchPanelOpen: jest.fn(),
    });

    mockUseCiLiteAnimations.mockReturnValue({
      ringAnim: new Animated.Value(0),
      statusText: "Idle",
      statusLamp: "idle",
      progressAnim: new Animated.Value(0),
      shimmerAnim: new Animated.Value(0),
      progressPctClamped: 0,
      progressTarget: { label: "Idle" },
    });
  });

  function buildWorkflowState(overrides: Record<string, unknown> = {}) {
    return {
      visible: false,
      setVisible,
      dispatching: false,
      dispatchWorkflow,
      isTrackingRun: false,
      headerState: "idle",
      githubRepo: "owner/repo",
      branch: "main",
      targetRef: "main",
      jobId: null,
      runUrl: null,
      workflowId: WORKFLOW_CI_LITE,
      workflowRun: null,
      trackedRunId: null,
      stepInfo: { lint: "idle", typecheck: "idle" },
      onlyErrors: [],
      done: false,
      ok: false,
      busy: false,
      isAutofix: false,
      showError: "",
      logsLoading: false,
      runMeta: null,
      stopPolling: jest.fn(),
      ...overrides,
    };
  }

  it("opens the modal from the header without dispatching a new run", () => {
    mockUseCiLiteWorkflow.mockReturnValue(buildWorkflowState());

    const { getByLabelText } = render(<CiLiteHeaderButton />);

    fireEvent.press(getByLabelText("CI Lite (Lint + Typecheck)"));

    expect(setVisible).toHaveBeenCalledWith(true);
    expect(dispatchWorkflow).not.toHaveBeenCalled();
  });

  it("dispatches exactly once when the explicit modal start button is pressed", () => {
    mockUseCiLiteWorkflow.mockReturnValue(buildWorkflowState({ visible: true }));

    const { getByLabelText } = render(<CiLiteHeaderButton />);

    fireEvent.press(getByLabelText("CI Lite Run starten"));

    expect(dispatchWorkflow).toHaveBeenCalledTimes(1);
    expect(dispatchWorkflow).toHaveBeenCalledWith(WORKFLOW_CI_LITE);
  });

  it("keeps explicit run buttons disabled while a run is already being tracked", () => {
    mockUseCiLiteWorkflow.mockReturnValue(
      buildWorkflowState({
        visible: true,
        isTrackingRun: true,
        busy: true,
      }),
    );

    const { getByLabelText } = render(<CiLiteHeaderButton />);

    fireEvent.press(getByLabelText("CI Lite Run starten"));
    fireEvent.press(getByLabelText("CI Lite Autofix starten"));

    expect(dispatchWorkflow).not.toHaveBeenCalled();
  });
});
