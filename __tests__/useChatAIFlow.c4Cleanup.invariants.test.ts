import fs from "fs";
import path from "path";

describe("Bereich 6 / C4 cleanup invariants", () => {
  const flowFile = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const screenFile = path.join(process.cwd(), "screens/ChatScreen/hooks/useChatScreen.ts");
  const flowSource = fs.readFileSync(flowFile, "utf8");
  const screenSource = fs.readFileSync(screenFile, "utf8");

  it("resetTransientState clears pending plan/change + modal/UI transient state", () => {
    expect(flowSource).toContain("const resetTransientState = useCallback(() => {");
    expect(flowSource).toContain("pendingPlanRef.current = null;");
    expect(flowSource).toContain("pendingChangeRef.current = null;");
    expect(flowSource).toContain("safe(() => setShowConfirmModal(false));");
    expect(flowSource).toContain("safe(() => setPendingPlan(null));");
    expect(flowSource).toContain("safe(() => setPendingChange(null));");
    expect(flowSource).toContain("abortControllerRef.current?.abort();");
    expect(flowSource).toContain("queuedAutoFixRef.current = [];");
  });

  it("ChatScreen focus cleanup invokes resetTransientState to avoid carry-over across navigation", () => {
    expect(screenSource).toContain("return () => {");
    expect(screenSource).toContain("resetTransientState();");
    expect(screenSource).toContain("}, [hardScrollToBottom, resetTransientState]),");
  });
});
