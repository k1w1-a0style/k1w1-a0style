import { runExplainStage } from "../hooks/chatAIFlowRequestOrchestrator";

describe("runExplainStage ops-only semantics", () => {
  it("runs explain stage for delete/rename-only changes", async () => {
    const runOrchestratorWithTimeout = jest.fn().mockResolvedValue({
      ok: true,
      text: "Delete/Rename erklärt",
    });
    const notifyKeyRotation = jest.fn();

    const out = await runExplainStage({
      config: {
        selectedChatProvider: "openai",
        selectedChatMode: "gpt-5-mini",
      } as never,
      requestContent: "Bitte refactoren",
      currentProjectFiles: [{ path: "src/old.ts", content: "x" }],
      mergedFiles: [{ path: "src/new.ts", content: "x" }],
      created: [],
      updated: [],
      deleted: ["src/old.ts"],
      renamed: [{ from: "src/old.ts", to: "src/new.ts" }],
      runOrchestratorWithTimeout,
      notifyKeyRotation,
    });

    expect(runOrchestratorWithTimeout).toHaveBeenCalledTimes(1);
    expect(out).toBe("Delete/Rename erklärt");
  });
});

