import { runSyncStep, runVerifyStep } from "../screens/DiagnosticScreen/hooks/fixRunnerExecutionHelpers";

describe("fixRunnerExecutionHelpers", () => {
  test("runSyncStep advances cursor when disabled", async () => {
    const runFixStep = jest.fn();
    const finishWithResult = jest.fn();
    const result = await runSyncStep({
      enabled: false,
      stepIndex: 2,
      runFixStep,
      sync: async () => undefined,
      finishWithResult,
      localChangeApplied: false,
    });
    expect(result).toEqual({ ok: true, nextIndex: 2 });
    expect(runFixStep).not.toHaveBeenCalled();
    expect(finishWithResult).not.toHaveBeenCalled();
  });

  test("runSyncStep returns failed result on sync error", async () => {
    const runFixStep = jest.fn(async () => new Error("sync kaputt"));
    const finishWithResult = jest.fn();
    const result = await runSyncStep({
      enabled: true,
      stepIndex: 1,
      runFixStep,
      sync: async () => undefined,
      finishWithResult,
      localChangeApplied: true,
    });

    expect(result).toEqual({ ok: false, nextIndex: 1 });
    expect(finishWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        detail: "sync kaputt",
        localChangeApplied: true,
        partial: true,
        stepIndex: 1,
      }),
    );
  });

  test("runVerifyStep emits pending_recheck on verify error", async () => {
    const runFixStep = jest.fn(async () => new Error("verify kaputt"));
    const finishWithResult = jest.fn();
    const result = await runVerifyStep({
      enabled: true,
      stepIndex: 3,
      runFixStep,
      verify: async () => undefined,
      finishWithResult,
      localChangeApplied: true,
      workflowTriggered: true,
    });

    expect(result).toEqual({ ok: false, nextIndex: 3 });
    expect(finishWithResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending_recheck",
        detail: "verify kaputt",
        localChangeApplied: true,
        workflowTriggered: true,
        stepIndex: 3,
      }),
    );
  });
});
