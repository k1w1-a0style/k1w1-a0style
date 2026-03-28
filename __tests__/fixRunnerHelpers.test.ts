import {
  buildBatchFixSteps,
  buildIssueFixSteps,
  buildSingleFixSteps,
  setStepStatusAtIndex,
} from "../screens/DiagnosticScreen/hooks/fixRunnerHelpers";

describe("fixRunnerHelpers", () => {
  test("buildIssueFixSteps keeps step order/keys semantically stable", () => {
    expect(
      buildIssueFixSteps({
        hasPatch: true,
        hasDispatch: true,
        doSync: true,
        rerunAfterFix: true,
      }),
    ).toEqual([
      { key: "apply", title: "Patch lokal anwenden", status: "pending" },
      { key: "dispatch", title: "Workflow-Fix starten", status: "pending" },
      { key: "sync", title: "Änderung ins Repo syncen", status: "pending" },
      { key: "rerun", title: "Diagnostics erneut prüfen", status: "pending" },
    ]);
  });

  test("buildSingleFixSteps keeps apply/sync/rerun plan semantics", () => {
    expect(buildSingleFixSteps({ doSync: false, rerunAfterFix: false })).toEqual([
      { key: "apply", title: "Patch lokal anwenden", status: "pending" },
    ]);

    expect(buildSingleFixSteps({ doSync: true, rerunAfterFix: true })).toEqual([
      { key: "apply", title: "Patch lokal anwenden", status: "pending" },
      { key: "sync", title: "Änderung ins Repo syncen", status: "pending" },
      { key: "rerun", title: "Diagnostics erneut prüfen", status: "pending" },
    ]);
  });

  test("buildBatchFixSteps keeps apply/sync expansion and rerun tail", () => {
    expect(
      buildBatchFixSteps(
        [
          { id: "a", title: "Fix A", doSync: false },
          { id: "b", title: "Fix B", doSync: true },
        ],
        true,
      ),
    ).toEqual([
      { key: "apply:a", title: "Patch: Fix A", status: "pending" },
      { key: "apply:b", title: "Patch: Fix B", status: "pending" },
      { key: "sync:b", title: "Sync: Fix B", status: "pending" },
      { key: "rerun", title: "Diagnostics erneut prüfen", status: "pending" },
    ]);
  });

  test("setStepStatusAtIndex only mutates one step", () => {
    const base = [
      { key: "apply", title: "Patch lokal anwenden", status: "pending" as const },
      { key: "sync", title: "Änderung ins Repo syncen", status: "pending" as const },
    ];

    expect(
      setStepStatusAtIndex(base, 1, {
        status: "failed",
        message: "Sync fehlgeschlagen",
      }),
    ).toEqual([
      { key: "apply", title: "Patch lokal anwenden", status: "pending" },
      {
        key: "sync",
        title: "Änderung ins Repo syncen",
        status: "failed",
        message: "Sync fehlgeschlagen",
      },
    ]);
  });
});
