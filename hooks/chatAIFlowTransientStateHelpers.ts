export type MutableRef<T> = { current: T };

export const clearInFlightTransientState = ({
  cleanupStreamingTimer,
  streamingRunIdRef,
  abortControllerRef,
  inFlightRef,
  queuedAutoFixRef,
}: {
  cleanupStreamingTimer: () => void;
  streamingRunIdRef: MutableRef<number>;
  abortControllerRef: MutableRef<AbortController | null>;
  inFlightRef: MutableRef<boolean>;
  queuedAutoFixRef: MutableRef<string[]>;
}): void => {
  cleanupStreamingTimer();
  streamingRunIdRef.current += 1;
  abortControllerRef.current?.abort();
  abortControllerRef.current = null;
  inFlightRef.current = false;
  queuedAutoFixRef.current = [];
};

export const clearPendingDecisionState = ({
  pendingPlanRef,
  pendingChangeRef,
}: {
  pendingPlanRef: MutableRef<unknown | null>;
  pendingChangeRef: MutableRef<unknown | null>;
}): void => {
  pendingPlanRef.current = null;
  pendingChangeRef.current = null;
};

type UiSetters = {
  setIsStreaming: (value: boolean) => void;
  setStreamingMessage: (value: string) => void;
  setIsAiLoading: (value: boolean) => void;
  setShowConfirmModal?: (value: boolean) => void;
  setPendingPlan?: (value: null) => void;
  setPendingChange?: (value: null) => void;
};

export const resetTransientUiState = ({
  safe,
  setters,
  clearPendingDecisions,
  closeConfirmModal,
}: {
  safe: <T>(fn: () => T) => T | undefined;
  setters: UiSetters;
  clearPendingDecisions: boolean;
  closeConfirmModal: boolean;
}): void => {
  safe(() => setters.setIsStreaming(false));
  safe(() => setters.setStreamingMessage(""));
  safe(() => setters.setIsAiLoading(false));

  if (closeConfirmModal && setters.setShowConfirmModal) {
    safe(() => setters.setShowConfirmModal?.(false));
  }

  if (clearPendingDecisions) {
    safe(() => setters.setPendingPlan?.(null));
    safe(() => setters.setPendingChange?.(null));
  }
};
