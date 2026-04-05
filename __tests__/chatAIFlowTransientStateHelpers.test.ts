import {
  clearInFlightTransientState,
  clearPendingDecisionState,
  resetTransientUiState,
} from "../hooks/chatAIFlowTransientStateHelpers";

describe("chatAIFlowTransientStateHelpers", () => {
  it("clearInFlightTransientState aborts active controller, increments run id and clears queue", () => {
    const abort = jest.fn();
    const controller = { abort } as unknown as AbortController;

    const streamingRunIdRef = { current: 2 };
    const abortControllerRef = { current: controller as AbortController | null };
    const inFlightRef = { current: true };
    const queuedAutoFixRef = { current: ["a", "b"] };
    const cleanupStreamingTimer = jest.fn();

    clearInFlightTransientState({
      cleanupStreamingTimer,
      streamingRunIdRef,
      abortControllerRef,
      inFlightRef,
      queuedAutoFixRef,
    });

    expect(cleanupStreamingTimer).toHaveBeenCalledTimes(1);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(streamingRunIdRef.current).toBe(3);
    expect(abortControllerRef.current).toBeNull();
    expect(inFlightRef.current).toBe(false);
    expect(queuedAutoFixRef.current).toEqual([]);
  });

  it("clearPendingDecisionState clears pending plan and change refs", () => {
    const pendingPlanRef = { current: { mode: "scout" } };
    const pendingChangeRef = { current: { files: ["App.tsx"] } };

    clearPendingDecisionState({
      pendingPlanRef,
      pendingChangeRef,
    });

    expect(pendingPlanRef.current).toBeNull();
    expect(pendingChangeRef.current).toBeNull();
  });

  it("resetTransientUiState supports full reset and blur-only reset variants", () => {
    const safe = <T,>(fn: () => T): T => fn();

    const setIsStreaming = jest.fn();
    const setStreamingMessage = jest.fn();
    const setIsAiLoading = jest.fn();
    const setShowConfirmModal = jest.fn();
    const setPendingPlan = jest.fn();
    const setPendingChange = jest.fn();

    resetTransientUiState({
      safe,
      setters: {
        setIsStreaming,
        setStreamingMessage,
        setIsAiLoading,
        setShowConfirmModal,
        setPendingPlan,
        setPendingChange,
      },
      clearPendingDecisions: true,
      closeConfirmModal: true,
    });

    expect(setIsStreaming).toHaveBeenCalledWith(false);
    expect(setStreamingMessage).toHaveBeenCalledWith("");
    expect(setIsAiLoading).toHaveBeenCalledWith(false);
    expect(setShowConfirmModal).toHaveBeenCalledWith(false);
    expect(setPendingPlan).toHaveBeenCalledWith(null);
    expect(setPendingChange).toHaveBeenCalledWith(null);

    const blurSetIsStreaming = jest.fn();
    const blurSetStreamingMessage = jest.fn();
    const blurSetIsAiLoading = jest.fn();
    const blurSetShowConfirmModal = jest.fn();

    resetTransientUiState({
      safe,
      setters: {
        setIsStreaming: blurSetIsStreaming,
        setStreamingMessage: blurSetStreamingMessage,
        setIsAiLoading: blurSetIsAiLoading,
        setShowConfirmModal: blurSetShowConfirmModal,
      },
      clearPendingDecisions: false,
      closeConfirmModal: false,
    });

    expect(blurSetIsStreaming).toHaveBeenCalledWith(false);
    expect(blurSetStreamingMessage).toHaveBeenCalledWith("");
    expect(blurSetIsAiLoading).toHaveBeenCalledWith(false);
    expect(blurSetShowConfirmModal).not.toHaveBeenCalled();
  });
});
