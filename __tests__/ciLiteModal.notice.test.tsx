import React from "react";
import { Animated } from "react-native";
import { render } from "@testing-library/react-native";

import { CiLiteModal } from "../components/CiLiteHeaderButton/components/CiLiteModal";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

function buildProps(overrides: Partial<React.ComponentProps<typeof CiLiteModal>> = {}): React.ComponentProps<typeof CiLiteModal> {
  return {
    visible: true,
    onClose: jest.fn(),
    isAutofix: false,
    statusText: "Bereit",
    statusLamp: "waiting",
    busy: false,
    done: false,
    ok: false,
    showError: "",
    artifactNotice: "",
    githubRepo: "owner/repo",
    targetRef: "main",
    branch: "main",
    jobId: null,
    stepInfo: { lint: "waiting", typecheck: "waiting" },
    runMeta: null,
    hydratedFromPersistence: false,
    onlyErrors: [],
    progressAnim: new Animated.Value(0),
    shimmerAnim: new Animated.Value(0),
    progressPctClamped: 0,
    progressLabel: "",
    patchPanelOpen: false,
    patchText: "",
    onChangePatchText: jest.fn(),
    patchBusy: false,
    patchInfo: null,
    onPaste: jest.fn(),
    onValidate: jest.fn(),
    onApply: jest.fn(),
    onClosePatch: jest.fn(),
    onOpenPatchPanel: jest.fn(),
    runUrl: null,
    workflowRunUrl: undefined,
    dispatching: false,
    isTrackingRun: false,
    addChatMessage: jest.fn(),
    dispatchWorkflow: jest.fn(),
    ...overrides,
  };
}

describe("CiLiteModal dispatch source notice", () => {
  it("shows the dispatch source notice for an idle local-start context without persisted run state", () => {
    const { getByText } = render(<CiLiteModal {...buildProps()} />);

    expect(getByText("Dispatch-Quelle")).toBeTruthy();
  });

  it("hides the dispatch source notice during active or hydrated run contexts", () => {
    const activeModal = render(
      <CiLiteModal
        {...buildProps({
          busy: true,
          isTrackingRun: true,
          statusText: "Lint-Check läuft",
          statusLamp: "running",
        })}
      />,
    );

    expect(activeModal.queryByText("Dispatch-Quelle")).toBeNull();

    const hydratedModal = render(
      <CiLiteModal
        {...buildProps({
          hydratedFromPersistence: true,
          done: true,
          ok: true,
          statusText: "Alles grün",
          statusLamp: "success",
        })}
      />,
    );

    expect(hydratedModal.queryByText("Dispatch-Quelle")).toBeNull();
  });
});
