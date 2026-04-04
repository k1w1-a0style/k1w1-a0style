import {
  buildBatchExecutionPlan,
  collectBatchPatchItems,
  collectBatchSafetyPatches,
} from "../screens/DiagnosticScreen/hooks/fixRunnerBatchPlanHelpers";
import { makePreflightPatch, makePreflightResult } from "./helpers/preflightTestHelpers";

describe("fixRunnerBatchPlanHelpers", () => {
  test("collectBatchPatchItems returns only patch-backed results", () => {
    const withPatch = makePreflightResult({
      id: "a",
      title: "A",
      fix: { patch: makePreflightPatch() },
    });
    const withoutPatch = makePreflightResult({ id: "b", title: "B" });

    const items = collectBatchPatchItems([withPatch, withoutPatch]);
    expect(items).toHaveLength(1);
    expect(items[0]?.result.id).toBe("a");
  });

  test("collectBatchSafetyPatches maps title+patch for safety scanners", () => {
    const withPatch = makePreflightResult({
      id: "a",
      title: "A",
      fix: { patch: makePreflightPatch() },
    });
    const mapped = collectBatchSafetyPatches([withPatch]);
    expect(mapped).toEqual([{ title: "A", patch: withPatch.fix!.patch }]);
  });

  test("buildBatchExecutionPlan dedupes patches and builds sync-aware steps", () => {
    const sharedPatch = makePreflightPatch({
      upsert: [{ path: "app.json", content: "{\"expo\":{\"name\":\"demo\"}}" }],
    });
    const a = makePreflightResult({ id: "a", title: "A", fix: { patch: sharedPatch } });
    const b = makePreflightResult({ id: "b", title: "B", fix: { patch: sharedPatch } });

    const plan = buildBatchExecutionPlan({
      items: [a, b],
      rerunAfterFix: true,
      shouldSyncPatch: () => true,
    });

    expect(plan.deduped).toHaveLength(1);
    expect(plan.skipped).toBe(1);
    expect(plan.steps.map((s) => s.key)).toEqual(["apply:a", "sync:a", "rerun"]);
  });
});
