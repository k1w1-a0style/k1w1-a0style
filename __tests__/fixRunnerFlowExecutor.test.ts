import { makePreflightPatch, makePreflightResult } from "./helpers/preflightTestHelpers";
import {
  buildSingleFixPromptMessage,
  executeBatchFixFlow,
  getSingleFixPromptMeta,
} from "../screens/DiagnosticScreen/hooks/fixRunnerFlowExecutor";

describe("fixRunnerFlowExecutor", () => {
  test("getSingleFixPromptMeta blocks oversized patches without weakening limits", () => {
    const result = makePreflightResult({
      id: "huge",
      title: "Huge",
      fix: {
        patch: makePreflightPatch({
          upsert: [{ path: "app.json", content: "x".repeat(250_001) }],
        }),
      },
    });

    const meta = getSingleFixPromptMeta({
      result,
      linkedRepo: "owner/repo",
      shouldSyncPatch: () => true,
    });

    expect(meta.patch).toBeNull();
    expect(meta.blockedReason).toContain("zu groß/komplex");
  });

  test("executeBatchFixFlow surfaces hard-limit block and keeps flow closed", async () => {
    const item = makePreflightResult({
      id: "huge-batch",
      title: "Huge batch",
      fix: {
        patch: makePreflightPatch({
          upsert: [{ path: "app.json", content: "y".repeat(250_001) }],
        }),
      },
    });

    const onHardLimitBlock = jest.fn();
    const openFixModal = jest.fn();

    await executeBatchFixFlow({
      items: [item],
      label: "Batch",
      onHardLimitBlock,
      rerunAfterFix: false,
      openFixModal,
      runFixStep: jest.fn(async () => true),
      finishWithResult: jest.fn(),
      runDiagnostics: jest.fn(async () => undefined),
      applyPatch: jest.fn(async () => undefined),
      shouldSyncPatch: jest.fn(() => false),
      syncPatchToGitHub: jest.fn(async () => undefined),
    });

    expect(onHardLimitBlock).toHaveBeenCalledWith(expect.stringContaining("zu groß/komplex"));
    expect(openFixModal).not.toHaveBeenCalled();
  });

  test("buildSingleFixPromptMessage keeps sync hint wording", () => {
    const result = makePreflightResult({
      id: "single",
      title: "Single",
      message: "details",
    });

    const text = buildSingleFixPromptMessage({
      result,
      syncWouldHelp: true,
      sizeNote: "",
    });

    expect(text).toContain("Sync macht Sinn");
  });
});
