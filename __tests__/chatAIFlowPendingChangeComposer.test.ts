import { composePendingChange, computeMergeResult } from "../hooks/chatAIFlowPendingChangeComposer";

describe("chatAIFlowPendingChangeComposer", () => {
  const currentProjectFiles = [
    { path: "app.json", content: '{"name":"demo"}' },
    { path: "README.md", content: "before" },
  ];

  const finalFiles = [
    { path: "src/new.ts", content: "export const ok = true;" },
  ];

  it("computes merge details for explain-stage gating without mutating caller inputs", () => {
    const merge = computeMergeResult(currentProjectFiles, finalFiles);

    expect(merge.created).toEqual(["src/new.ts"]);
    expect(merge.updated).toEqual([]);
    expect(currentProjectFiles[0]?.content).toBe('{"name":"demo"}');
  });

  it("composes pending-change payload with stable summary + validator metadata", () => {
    const composed = composePendingChange({
      isAutoFix: false,
      currentProjectFiles,
      finalFiles,
      proposedFiles: finalFiles,
      aiResponse: { ok: true, text: "builder", provider: "openai" },
      agentResponse: { ok: true, text: "validator", provider: "openai" },
      finalFileSource: "validator",
      validatorState: "validated",
      sourceSummary: "Quelle: Validator",
      explainText: "Kurze Erklärung",
      preflightIntro: "Preflight Intro",
      buildPathBulletList: (paths) => paths.join(","),
    });

    expect(composed.mergeResult.created).toEqual(["src/new.ts"]);
    expect(composed.mergeResult.updated).toEqual([]);
    expect(composed.pendingChange.files).toEqual(composed.mergeResult.files);
    expect(composed.pendingChange.proposedFiles).toEqual(finalFiles);
    expect(composed.pendingChange.finalFileSource).toBe("validator");
    expect(composed.pendingChange.validatorState).toBe("validated");
    expect(composed.pendingChange.sourceSummary).toBe("Quelle: Validator");
    expect(composed.summaryText).toContain("Preflight Intro");
    expect(composed.summaryText).toContain("Kurze Erklärung");
  });
});
