import {
  dedupePatchCandidates,
  pickAutoFixCandidates,
  pickSelectedFixCandidates,
  pickSmartFixCandidates,
  resolveWorkflowDispatchTarget,
} from "../screens/DiagnosticScreen/hooks/fixRunnerOrchestrationHelpers";
import { makePreflightPatch, makePreflightResult } from "./helpers/preflightTestHelpers";

describe("fixRunnerOrchestrationHelpers", () => {
  test("dedupes patch candidates by fingerprint while preserving order", () => {
    const patch = makePreflightPatch({
      upsert: [{ path: "app.json", content: "{\"expo\":{\"name\":\"x\"}}" }],
    });
    const a = makePreflightResult({ id: "a", title: "A", fix: { patch } });
    const b = makePreflightResult({ id: "b", title: "B", fix: { patch } });

    const deduped = dedupePatchCandidates([
      { result: a, patch },
      { result: b, patch },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.result.id).toBe("a");
  });

  test("smart fix only picks fail status items with patch", () => {
    const fail = makePreflightResult({ id: "fail", status: "fail", fix: { patch: makePreflightPatch() } });
    const warn = makePreflightResult({ id: "warn", status: "warn", fix: { patch: makePreflightPatch() } });
    const noPatch = makePreflightResult({ id: "nopatch", status: "fail" });

    const candidates = pickSmartFixCandidates([fail, warn, noPatch]);

    expect(candidates.map(({ result }) => result.id)).toEqual(["fail"]);
  });

  test("auto fix picks fail + optional warn according to scope", () => {
    const fail = makePreflightResult({ id: "fail", status: "fail", fix: { patch: makePreflightPatch() } });
    const warn = makePreflightResult({ id: "warn", status: "warn", fix: { patch: makePreflightPatch() } });

    const withoutWarn = pickAutoFixCandidates({
      autoFixScope: "visible",
      visibleResults: [fail, warn],
      fixableResults: [],
      autoFixIncludeWarn: false,
    });
    const withWarn = pickAutoFixCandidates({
      autoFixScope: "visible",
      visibleResults: [fail, warn],
      fixableResults: [],
      autoFixIncludeWarn: true,
    });

    expect(withoutWarn.map(({ result }) => result.id)).toEqual(["fail"]);
    expect(withWarn.map(({ result }) => result.id)).toEqual(["fail", "warn"]);
  });

  test("selected fix candidates follow selected id map", () => {
    const one = makePreflightResult({ id: "one", fix: { patch: makePreflightPatch() } });
    const two = makePreflightResult({ id: "two", fix: { patch: makePreflightPatch() } });

    const chosen = pickSelectedFixCandidates({
      sortedResults: [one, two],
      selected: { one: true, two: false },
    });

    expect(chosen.map(({ result }) => result.id)).toEqual(["one"]);
  });

  test("workflow dispatch target keeps missing repo/branch guard semantics", () => {
    expect(resolveWorkflowDispatchTarget({ linkedRepo: "", linkedBranch: "main" })).toEqual({
      ok: false,
      detail: "Workflow-Fix ist ohne verknüpftes Repo nicht anwendbar.",
    });
    expect(resolveWorkflowDispatchTarget({ linkedRepo: "owner/repo", linkedBranch: "" })).toEqual({
      ok: false,
      detail: "Workflow-Fix ist ohne verknüpften Branch nicht anwendbar.",
    });
    expect(
      resolveWorkflowDispatchTarget({
        linkedRepo: "owner/repo",
        linkedBranch: "main",
      }),
    ).toEqual({
      ok: true,
      owner: "owner",
      repo: "repo",
      workflowRef: "main",
    });
  });
});
