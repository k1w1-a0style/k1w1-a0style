import { DiagnosticFixApplyError } from "../lib/diagnostics/fixResultContract";
import {
  buildApplyFailureResult,
  buildFailedStepPatch,
  getErrorMessage,
  getFixRuntimeMeta,
} from "../screens/DiagnosticScreen/hooks/fixRunnerResultHelpers";

describe("fixRunnerResultHelpers", () => {
  test("buildFailedStepPatch truncates long messages to keep step feedback compact", () => {
    const longError = new Error(`A${"x".repeat(240)}`);
    const patch = buildFailedStepPatch(longError, "fallback");

    expect(patch.status).toBe("failed");
    expect(patch.message.length).toBeLessThan(longError.message.length);
    expect(patch.message).toContain("…");
  });

  test("getErrorMessage/getFixRuntimeMeta stay fail-safe for unknown thrown values", () => {
    const thrown = { localChangeApplied: true, partial: true };
    expect(getErrorMessage(thrown, "fallback")).toBe("fallback");
    expect(getFixRuntimeMeta(thrown)).toEqual({
      localChangeApplied: true,
      partial: true,
    });
  });

  test("buildApplyFailureResult preserves DiagnosticFixApplyError status and runtime flags", () => {
    const error = new DiagnosticFixApplyError({
      message: "blocked by ownership",
      status: "blocked",
      localChangeApplied: true,
      partial: true,
    });

    const result = buildApplyFailureResult({
      error,
      fallback: "fallback",
      stepIndex: 2,
    });

    expect(result).toEqual({
      status: "blocked",
      detail: "blocked by ownership",
      localChangeApplied: true,
      partial: true,
      stepIndex: 2,
    });
  });

  test("buildApplyFailureResult allows explicit local change/partial fallback from caller context", () => {
    const result = buildApplyFailureResult({
      error: new Error("apply failed"),
      fallback: "fallback",
      stepIndex: 3,
      localChangeApplied: true,
      partial: true,
    });

    expect(result).toEqual({
      status: "failed",
      detail: "apply failed",
      localChangeApplied: true,
      partial: true,
      stepIndex: 3,
    });
  });
});
