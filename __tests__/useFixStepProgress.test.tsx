import React from "react";
import { act, render } from "@testing-library/react-native";

import { useFixStepProgress } from "../screens/DiagnosticScreen/hooks/useFixStepProgress";
import type { FixStep } from "../screens/DiagnosticScreen/types";

function createHarness<T>(useHook: () => T) {
  let api: T | null = null;
  function Harness() {
    api = useHook();
    return null;
  }
  render(<Harness />);
  if (!api) throw new Error("Harness did not initialize");
  return () => api as T;
}

const initialSteps: FixStep[] = [{ key: "apply", title: "Patch lokal anwenden", status: "pending" }];

describe("useFixStepProgress", () => {
  test("keeps modal non-closable until a run is marked done", async () => {
    const getApi = createHarness(() => useFixStepProgress());

    await act(async () => {
      getApi().openFixModal({ title: "Fix", steps: initialSteps });
    });
    expect(getApi().fixModalVisible).toBe(true);

    await act(async () => {
      getApi().closeFixModal();
    });
    expect(getApi().fixModalVisible).toBe(true);

    await act(async () => {
      getApi().finishWithResult({ status: "patch_applied", stepIndex: 1 });
    });
    await act(async () => {
      getApi().closeFixModal();
    });
    expect(getApi().fixModalVisible).toBe(false);
  });

  test("runFixStep marks failed status and keeps error message", async () => {
    const getApi = createHarness(() => useFixStepProgress());
    await act(async () => {
      getApi().openFixModal({ title: "Fix", steps: initialSteps });
    });

    await act(async () => {
      await getApi().runFixStep({
        index: 0,
        run: async () => {
          throw new Error("kaputt");
        },
        failMessage: "Fehler",
      });
    });

    expect(getApi().fixStepIndex).toBe(0);
    expect(getApi().fixSteps[0]?.status).toBe("failed");
    expect(getApi().fixSteps[0]?.message).toContain("kaputt");
  });

  test("finishWithResult forwards summary to toast", async () => {
    const toast = { show: jest.fn() };
    const getApi = createHarness(() => useFixStepProgress(toast));

    await act(async () => {
      getApi().openFixModal({ title: "Fix", steps: initialSteps });
      getApi().finishWithResult({ status: "blocked", stepIndex: 0 });
    });

    expect(getApi().fixDone).toBe(true);
    expect(toast.show).toHaveBeenCalledWith("Fix blockiert – nichts wurde als behoben markiert.");
  });
});
