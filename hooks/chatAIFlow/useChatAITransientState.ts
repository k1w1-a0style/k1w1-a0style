import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { logger } from "../../lib/logger";
import { MAX_AUTOFIX_QUEUE } from "./chatAIFlow.contracts";
import {
  clearInFlightTransientState,
  clearPendingDecisionState,
  resetTransientUiState,
} from "../chatAIFlowTransientStateHelpers";
import {
  getScreenBlurAbortNotice,
  hasPreservedPendingState,
  shouldAbortOnScreenBlur,
} from "../chatAIFlowLifecycleHelpers";
import {
  buildSystemMessage,
  buildUserMessage,
} from "../chatAIFlowChatMessageFactory";
import type { PendingChange, PendingPlan } from "./chatAIFlow.contracts";
import type { ChatMessage } from "../../shared/types/chat";

export type UseChatAITransientStateArgs = {
  messages: ChatMessage[];
  autoFixRequest: { message: string } | null;
  clearAutoFixRequest: () => void;
  addChatMessage: (message: ChatMessage) => void;
  hardScrollToBottom: (animated: boolean) => void;
  setIsStreaming: (value: boolean) => void;
  setStreamingMessage: Dispatch<SetStateAction<string>>;
  setIsAiLoading: (value: boolean) => void;
  setShowConfirmModal: (value: boolean) => void;
  setPendingPlan: Dispatch<SetStateAction<PendingPlan | null>>;
  setPendingChange: Dispatch<SetStateAction<PendingChange | null>>;
  safe: <T>(fn: () => T) => T | undefined;
  inFlightRef: MutableRefObject<boolean>;
  isMountedRef: MutableRefObject<boolean>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  pendingPlanRef: MutableRefObject<PendingPlan | null>;
  pendingChangeRef: MutableRefObject<PendingChange | null>;
  processAIRequestRef: MutableRefObject<
    ((message: string, isAutoFix?: boolean, forceBuilder?: boolean) => Promise<boolean>) | null
  >;
};

export const useChatAITransientState = ({
  messages,
  autoFixRequest,
  clearAutoFixRequest,
  addChatMessage,
  hardScrollToBottom,
  setIsStreaming,
  setStreamingMessage,
  setIsAiLoading,
  setShowConfirmModal,
  setPendingPlan,
  setPendingChange,
  safe,
  inFlightRef,
  isMountedRef,
  abortControllerRef,
  pendingPlanRef,
  pendingChangeRef,
  processAIRequestRef,
}: UseChatAITransientStateArgs) => {
  const isAtBottomRef = useRef(true);
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingRunIdRef = useRef(0);
  const messagesRef = useRef(messages);
  const queuedAutoFixRef = useRef<string[]>([]);

  messagesRef.current = messages;

  const setAtBottom = useCallback((value: boolean) => {
    isAtBottomRef.current = value;
  }, []);

  const cleanupStreamingTimer = useCallback(() => {
    if (streamingTimerRef.current) {
      clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      cleanupStreamingTimer();
      streamingRunIdRef.current += 1;
      inFlightRef.current = false;
    };
  }, [abortControllerRef, cleanupStreamingTimer, inFlightRef, isMountedRef]);

  const simulateStreaming = useCallback(
    (fullText: string, onComplete: () => void) => {
      cleanupStreamingTimer();
      const runId = ++streamingRunIdRef.current;

      safe(() => setIsStreaming(true));
      safe(() => setStreamingMessage(""));

      let currentIndex = 0;
      const chunkSize = 12;
      const delay = 18;

      const tick = () => {
        if (!isMountedRef.current || runId !== streamingRunIdRef.current) {
          cleanupStreamingTimer();
          return;
        }

        if (currentIndex < fullText.length) {
          const nextChunk = fullText.slice(currentIndex, currentIndex + chunkSize);
          currentIndex += chunkSize;

          safe(() => setStreamingMessage((prev) => prev + nextChunk));

          if (isAtBottomRef.current) {
            requestAnimationFrame(() => hardScrollToBottom(false));
          }

          streamingTimerRef.current = setTimeout(tick, delay);
          return;
        }

        cleanupStreamingTimer();
        if (runId !== streamingRunIdRef.current) return;

        safe(() => setIsStreaming(false));
        if (isAtBottomRef.current) {
          requestAnimationFrame(() => hardScrollToBottom(true));
        }

        onComplete();
      };

      streamingTimerRef.current = setTimeout(tick, delay);
    },
    [cleanupStreamingTimer, hardScrollToBottom, isMountedRef, safe, setIsStreaming, setStreamingMessage],
  );

  const drainAutoFixQueue = useCallback(() => {
    if (inFlightRef.current) return;

    const message = queuedAutoFixRef.current.shift();
    if (!message) return;

    addChatMessage(buildUserMessage(message, { autoFix: true }));
    const runner = processAIRequestRef.current;
    if (runner) void runner(message, true, true);
  }, [addChatMessage, inFlightRef, processAIRequestRef]);

  useEffect(() => {
    const message = autoFixRequest?.message;
    if (!message) return;

    if (queuedAutoFixRef.current.length >= MAX_AUTOFIX_QUEUE) {
      logger.warn(
        `[useChatAIFlow] AutoFix queue full (${MAX_AUTOFIX_QUEUE}), dropping: ${message.slice(0, 80)}`,
      );
      clearAutoFixRequest();
      return;
    }

    queuedAutoFixRef.current.push(message);
    clearAutoFixRequest();
    drainAutoFixQueue();
  }, [autoFixRequest, clearAutoFixRequest, drainAutoFixQueue]);

  const resetTransientState = useCallback(() => {
    clearInFlightTransientState({
      cleanupStreamingTimer,
      streamingRunIdRef,
      abortControllerRef,
      inFlightRef,
      queuedAutoFixRef,
    });
    clearPendingDecisionState({
      pendingPlanRef,
      pendingChangeRef,
    });
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
  }, [
    abortControllerRef,
    cleanupStreamingTimer,
    inFlightRef,
    pendingChangeRef,
    pendingPlanRef,
    safe,
    setIsAiLoading,
    setIsStreaming,
    setPendingChange,
    setPendingPlan,
    setShowConfirmModal,
    setStreamingMessage,
  ]);

  const handleScreenBlurCleanup = useCallback(() => {
    const shouldAbort = shouldAbortOnScreenBlur({
      inFlight: inFlightRef.current,
      hasAbortController: abortControllerRef.current !== null,
      queuedAutoFixCount: queuedAutoFixRef.current.length,
    });
    if (!shouldAbort) return;

    const preservedPendingState = hasPreservedPendingState({
      hasPendingPlan: pendingPlanRef.current !== null,
      hasPendingChange: pendingChangeRef.current !== null,
    });

    clearInFlightTransientState({
      cleanupStreamingTimer,
      streamingRunIdRef,
      abortControllerRef,
      inFlightRef,
      queuedAutoFixRef,
    });

    resetTransientUiState({
      safe,
      setters: {
        setIsStreaming,
        setStreamingMessage,
        setIsAiLoading,
      },
      clearPendingDecisions: false,
      closeConfirmModal: false,
    });

    addChatMessage(
      buildSystemMessage(getScreenBlurAbortNotice(preservedPendingState), {
        requestAbortedOnBlur: true,
        preservedPendingState,
      }),
    );
  }, [
    abortControllerRef,
    addChatMessage,
    cleanupStreamingTimer,
    inFlightRef,
    pendingChangeRef,
    pendingPlanRef,
    safe,
    setIsAiLoading,
    setIsStreaming,
    setStreamingMessage,
  ]);

  return {
    isAtBottomRef,
    messagesRef,
    queuedAutoFixRef,
    setAtBottom,
    cleanupStreamingTimer,
    simulateStreaming,
    drainAutoFixQueue,
    resetTransientState,
    handleScreenBlurCleanup,
  };
};
