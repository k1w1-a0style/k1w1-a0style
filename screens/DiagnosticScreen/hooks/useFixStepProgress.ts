import { useCallback, useState } from "react";

import { getDiagnosticFixExecutionResult } from "../../../lib/diagnostics/fixResultContract";
import { buildFailedStepPatch } from "./fixRunnerResultHelpers";
import { setStepStatusAtIndex } from "./fixRunnerHelpers";
import type { FixStep } from "../types";

type ToastLike = { show: (msg: string) => void };

type FinishParams = {
  status:
    | "advisory_only"
    | "patch_applicable"
    | "patch_applied"
    | "workflow_dispatched"
    | "blocked"
    | "failed"
    | "pending_recheck";
  detail?: string;
  localChangeApplied?: boolean;
  workflowTriggered?: boolean;
  partial?: boolean;
  stepIndex?: number;
};

export function useFixStepProgress(toast?: ToastLike) {
  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [fixModalTitle, setFixModalTitle] = useState("AutoFix");
  const [fixModalSubtitle, setFixModalSubtitle] = useState<string | undefined>(
    undefined,
  );
  const [fixSteps, setFixSteps] = useState<FixStep[]>([]);
  const [fixStepIndex, setFixStepIndex] = useState(0);
  const [fixDone, setFixDone] = useState(false);

  const finishWithResult = useCallback(
    (params: FinishParams) => {
      const result = getDiagnosticFixExecutionResult(params);
      setFixDone(true);
      if (typeof params.stepIndex === "number") {
        setFixStepIndex(params.stepIndex);
      }
      toast?.show?.(result.summary);
      return result;
    },
    [toast],
  );

  const closeFixModal = useCallback(() => {
    if (!fixDone) return;
    setFixModalVisible(false);
  }, [fixDone]);

  const openFixModal = useCallback(
    (params: { title: string; subtitle?: string; steps: FixStep[] }) => {
      setFixModalTitle(params.title);
      setFixModalSubtitle(params.subtitle);
      setFixSteps(params.steps);
      setFixStepIndex(0);
      setFixDone(false);
      setFixModalVisible(true);
    },
    [],
  );

  const markFixStepRunning = useCallback((index: number) => {
    setFixStepIndex(index);
    setFixSteps((prev) => setStepStatusAtIndex(prev, index, { status: "running" }));
  }, []);

  const markFixStepDone = useCallback((index: number) => {
    setFixSteps((prev) => setStepStatusAtIndex(prev, index, { status: "done" }));
  }, []);

  const markFixStepFailed = useCallback(
    (index: number, error: unknown, fallback: string) => {
      setFixSteps((prev) =>
        setStepStatusAtIndex(prev, index, buildFailedStepPatch(error, fallback)),
      );
    },
    [],
  );

  const runFixStep = useCallback(
    async (params: {
      index: number;
      run: () => Promise<void>;
      failMessage: string;
    }): Promise<unknown | null> => {
      markFixStepRunning(params.index);
      try {
        await params.run();
        markFixStepDone(params.index);
        return null;
      } catch (error: unknown) {
        markFixStepFailed(params.index, error, params.failMessage);
        return error;
      }
    },
    [markFixStepDone, markFixStepFailed, markFixStepRunning],
  );

  return {
    fixModalVisible,
    fixModalTitle,
    fixModalSubtitle,
    fixSteps,
    fixStepIndex,
    fixDone,
    finishWithResult,
    closeFixModal,
    openFixModal,
    markFixStepRunning,
    markFixStepDone,
    markFixStepFailed,
    runFixStep,
  };
}
