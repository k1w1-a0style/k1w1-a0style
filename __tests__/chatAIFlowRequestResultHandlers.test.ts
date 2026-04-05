import { handlePipelineResult } from "../hooks/chatAIFlowRequestResultHandlers";
import type { PendingPlan } from "../hooks/chatAIFlowTypes";

describe("chatAIFlowRequestResultHandlers", () => {
  it("emits planner assistant message for confirmation-required results", () => {
    const addChatMessage = jest.fn();
    const setPendingPlan = jest.fn();
    const setPendingChange = jest.fn();
    const setShowConfirmModal = jest.fn();
    const simulateStreaming = jest.fn();

    handlePipelineResult({
      pipelineResult: { kind: "confirmation_required", message: "Bitte bestätigen" },
      addChatMessage,
      pendingPlanRef: { current: null },
      setPendingPlan,
      safe: (fn) => fn(),
      simulateStreaming,
      setPendingChange,
      setShowConfirmModal,
    });

    expect(addChatMessage).toHaveBeenCalledTimes(1);
    expect(setPendingPlan).not.toHaveBeenCalled();
    expect(simulateStreaming).not.toHaveBeenCalled();
  });

  it("stores pending plan and emits planner message for planner-preview results", () => {
    const addChatMessage = jest.fn();
    const pendingPlanRef: { current: PendingPlan | null } = { current: null };
    const pendingPlan: PendingPlan = {
      mode: "scout",
      originalRequest: "prompt",
      planText: "Plan",
    };
    const setPendingPlan = jest.fn();

    handlePipelineResult({
      pipelineResult: { kind: "planner_preview", message: "Vorschau", pendingPlan },
      addChatMessage,
      pendingPlanRef,
      setPendingPlan,
      safe: (fn) => fn(),
      simulateStreaming: jest.fn(),
      setPendingChange: jest.fn(),
      setShowConfirmModal: jest.fn(),
    });

    expect(addChatMessage).toHaveBeenCalledTimes(1);
    expect(pendingPlanRef.current).toBe(pendingPlan);
    expect(setPendingPlan).toHaveBeenCalledWith(pendingPlan);
  });

  it("streams change proposal and opens confirm modal after completion", () => {
    const setPendingChange = jest.fn();
    const setShowConfirmModal = jest.fn();
    const pendingChange = {
      summary: "summary",
      files: [],
      created: [],
      updated: [],
      skipped: [],
      errors: [],
      aiResponse: { ok: true },
    };

    const simulateStreaming = jest.fn((_: string, onComplete: () => void) => {
      onComplete();
    });

    handlePipelineResult({
      pipelineResult: { kind: "change_proposal", summaryText: "text", pendingChange },
      addChatMessage: jest.fn(),
      pendingPlanRef: { current: null },
      setPendingPlan: jest.fn(),
      safe: (fn) => fn(),
      simulateStreaming,
      setPendingChange,
      setShowConfirmModal,
    });

    expect(simulateStreaming).toHaveBeenCalledWith("text", expect.any(Function));
    expect(setPendingChange).toHaveBeenCalledWith(pendingChange);
    expect(setShowConfirmModal).toHaveBeenCalledWith(true);
  });
});
