import { buildAssistantMessage } from "./chatAIFlowChatMessageFactory";
import type { PendingChange, PendingPlan } from "./chatAIFlowTypes";
import type { RequestPipelineResult } from "./chatAIFlowRequestPipeline";

type MutableRef<T> = { current: T };

export const handlePipelineResult = ({
  pipelineResult,
  addChatMessage,
  pendingPlanRef,
  setPendingPlan,
  safe,
  simulateStreaming,
  setPendingChange,
  setShowConfirmModal,
}: {
  pipelineResult: RequestPipelineResult;
  addChatMessage: (message: ReturnType<typeof buildAssistantMessage>) => void;
  pendingPlanRef: MutableRef<PendingPlan | null>;
  setPendingPlan: (plan: PendingPlan | null) => void;
  safe: <T>(fn: () => T) => T | undefined;
  simulateStreaming: (fullText: string, onComplete: () => void) => void;
  setPendingChange: (change: PendingChange | null) => void;
  setShowConfirmModal: (value: boolean) => void;
}): void => {
  if (pipelineResult.kind === "confirmation_required") {
    addChatMessage(
      buildAssistantMessage(pipelineResult.message, { planner: true }),
    );
    return;
  }

  if (pipelineResult.kind === "planner_preview") {
    addChatMessage(
      buildAssistantMessage(pipelineResult.message, { planner: true }),
    );
    pendingPlanRef.current = pipelineResult.pendingPlan;
    safe(() => setPendingPlan(pipelineResult.pendingPlan));
    return;
  }

  simulateStreaming(pipelineResult.summaryText, () => {
    safe(() => setPendingChange(pipelineResult.pendingChange));
    safe(() => setShowConfirmModal(true));
  });
};
