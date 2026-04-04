import {
  buildIssueFixPlan,
  buildIssueFixSuccessResult,
  buildSingleFixPlan,
  buildSingleFixSuccessResult,
} from "../screens/DiagnosticScreen/hooks/fixRunnerFlowPlanHelpers";
import { makePreflightPatch, makePreflightResult } from "./helpers/preflightTestHelpers";

describe("fixRunnerFlowPlanHelpers", () => {
  test("buildIssueFixPlan derives patch/dispatch/sync flags", () => {
    const patch = makePreflightPatch();
    const result = makePreflightResult({
      fix: {
        patch,
        workflowDispatch: { workflowFileName: "eas-link.yml" },
      },
    });

    const plan = buildIssueFixPlan({
      result,
      rerunAfterFix: true,
      shouldSyncPatch: (p) => p === patch,
    });

    expect(plan.patchForApply).toBe(patch);
    expect(plan.dispatch?.workflowFileName).toBe("eas-link.yml");
    expect(plan.doSync).toBe(true);
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  test("issue success result keeps workflow-dispatched status when no patch and no rerun", () => {
    const out = buildIssueFixSuccessResult({
      rerunAfterFix: false,
      hasDispatch: false,
      patchApplied: false,
      stepsLength: 2,
    });
    expect(out.status).toBe("workflow_dispatched");
    expect(out.stepIndex).toBe(2);
  });

  test("buildSingleFixPlan and success result keep pending_recheck semantics", () => {
    const plan = buildSingleFixPlan({ doSync: true, rerunAfterFix: true });
    expect(plan.steps.map((s) => s.key)).toEqual(["apply", "sync", "rerun"]);

    const out = buildSingleFixSuccessResult({
      rerunAfterFix: true,
      patchApplied: true,
      stepsLength: plan.steps.length,
    });
    expect(out.status).toBe("pending_recheck");
    expect(out.localChangeApplied).toBe(true);
  });
});
