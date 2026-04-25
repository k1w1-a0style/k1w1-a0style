import fs from "fs";
import path from "path";

describe("Bereich 6 / C4 cleanup invariants", () => {
  const lifecycleHelpersFile = path.join(process.cwd(), "hooks/chatAIFlowLifecycleHelpers.ts");
  const transientHelpersFile = path.join(process.cwd(), "hooks/chatAIFlowTransientStateHelpers.ts");
  const transientHookFile = path.join(process.cwd(), "hooks/chatAIFlow/useChatAITransientState.ts");
  const screenFile = path.join(process.cwd(), "screens/ChatScreen/hooks/useChatScreen.ts");
  const lifecycleHelpersSource = fs.readFileSync(lifecycleHelpersFile, "utf8");
  const transientHelpersSource = fs.readFileSync(transientHelpersFile, "utf8");
  const transientHookSource = fs.readFileSync(transientHookFile, "utf8");
  const screenSource = fs.readFileSync(screenFile, "utf8");

  it("resetTransientState clears pending plan/change + modal/UI transient state", () => {
    expect(transientHookSource).toContain("const resetTransientState = useCallback(() => {");
    expect(transientHookSource).toContain("clearInFlightTransientState({");
    expect(transientHookSource).toContain("clearPendingDecisionState({");
    expect(transientHookSource).toContain("resetTransientUiState({");
    expect(transientHookSource).toContain("clearPendingDecisions: true");
    expect(transientHookSource).toContain("closeConfirmModal: true");
    expect(transientHelpersSource).toContain("abortControllerRef.current?.abort();");
    expect(transientHelpersSource).toContain("queuedAutoFixRef.current = [];");
    expect(transientHelpersSource).toContain("pendingPlanRef.current = null;");
    expect(transientHelpersSource).toContain("pendingChangeRef.current = null;");
  });

  it("ChatScreen focus cleanup invokes handleScreenBlurCleanup to keep blur semantics honest", () => {
    expect(transientHookSource).toContain("const handleScreenBlurCleanup = useCallback(() => {");
    expect(transientHookSource).toContain("requestAbortedOnBlur: true");
    expect(transientHookSource).toContain("const preservedPendingState = hasPreservedPendingState({");
    expect(transientHookSource).toContain("buildSystemMessage(");
    expect(transientHookSource).toContain("getScreenBlurAbortNotice(preservedPendingState)");
    expect(transientHookSource).toContain("clearPendingDecisions: false");
    expect(transientHookSource).toContain("closeConfirmModal: false");
    expect(lifecycleHelpersSource).toContain("export const shouldAbortOnScreenBlur = ({");
    expect(lifecycleHelpersSource).toContain("export const hasPreservedPendingState = ({");
    expect(lifecycleHelpersSource).toContain("export const getScreenBlurAbortNotice = (");
    expect(screenSource).toContain("return () => {");
    expect(screenSource).toContain("handleScreenBlurCleanup();");
    expect(screenSource).toContain("}, [hardScrollToBottom, handleScreenBlurCleanup]),");
  });
});
