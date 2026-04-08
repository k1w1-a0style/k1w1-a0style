import { useCallback, useMemo, useRef, useState } from "react";
import type { OrchestratorResult } from "../lib/orchestrator";
import { handleMetaCommand } from "../utils/metaCommands";
import {
  buildAssistantMessage,
  buildSystemMessage,
  buildUserMessage,
} from "./chatAIFlowChatMessageFactory";
import { getInputValidationMessage } from "./chatAIFlowNoticeHelpers";
import {
  getEmptyMessageNoticeText,
  getXssSanitizationNoticeText,
} from "./chatAIFlowNoticeMessageHelpers";
import { getNormalizedSendInputs } from "./chatAIFlowInputRoutingHelpers";
import {
  announceContextBudgetNoteEffect,
  announceRuntimeNoteEffect,
  notifyKeyRotationEffect,
} from "./chatAIFlowRequestSideEffects";
import { resolvePendingPlanHandoff } from "./chatAIFlowPendingPlanHandoff";
import { useChatAIRequestController } from "./chatAIFlow/useChatAIRequestController";
import { useChatAIChangeLifecycle } from "./chatAIFlow/useChatAIChangeLifecycle";
import { useChatAITransientState } from "./chatAIFlow/useChatAITransientState";
import {
  isDirectBuildCommand,
  prepareValidatedChatInput,
  buildPathBulletList,
  buildPreflightSummaryIntro,
  buildGuardPolicyPreHint,
  computeBuilderRetryDelayMs,
  runOrchestratorWithHardTimeout,
  CHAT_AI_REQUEST_TIMEOUT_MS,
} from "./chatAIFlow/chatAIFlowPureHelpers";
import type { PendingChange, PendingPlan, UseChatAIFlowArgs } from "./chatAIFlow/chatAIFlow.contracts";

export type { PendingChange, PendingPlan } from "./chatAIFlow/chatAIFlow.contracts";
export { extractContextBudgetNotice } from "./chatAIFlowContextBudgetHelpers";
export {
  CHAT_AI_REQUEST_TIMEOUT_MS,
  buildGuardPolicyPreHint,
  buildPathBulletList,
  buildPreflightSummaryIntro,
  computeBuilderRetryDelayMs,
  isDirectBuildCommand,
  prepareValidatedChatInput,
  runOrchestratorWithHardTimeout,
};

export function useChatAIFlow({
  config,
  messages,
  projectFiles,
  addChatMessage,
  updateProjectFiles,
  autoFixRequest,
  clearAutoFixRequest,
  hardScrollToBottom,
  setIsStreaming,
  setStreamingMessage,
  setIsAiLoading,
  setError,
  setShowConfirmModal,
}: UseChatAIFlowArgs) {
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const isMountedRef = useRef(true);
  const lastContextBudgetNoticeRef = useRef("");
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const processAIRequestRef = useRef<
    ((message: string, isAutoFix?: boolean, forceBuilder?: boolean) => Promise<boolean>) | null
  >(null);

  const projectFilesRef = useRef(projectFiles);
  projectFilesRef.current = projectFiles;

  const pendingPlanRef = useRef(pendingPlan);
  pendingPlanRef.current = pendingPlan;

  const pendingChangeRef = useRef(pendingChange);
  pendingChangeRef.current = pendingChange;

  const safe = useCallback(<T>(fn: () => T): T | undefined => {
    if (!isMountedRef.current) return undefined;
    return fn();
  }, []);

  const sleepWithAbort = useCallback((ms: number, signal?: AbortSignal) => {
    if (ms <= 0) return Promise.resolve();
    if (signal?.aborted) {
      return Promise.reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);

      const onAbort = () => {
        cleanup();
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      };

      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };

      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }, []);

  const {
    isAtBottomRef,
    messagesRef,
    setAtBottom,
    simulateStreaming,
    drainAutoFixQueue,
    resetTransientState,
    handleScreenBlurCleanup,
  } = useChatAITransientState({
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
  });

  const notifyKeyRotation = useCallback(
    (result: OrchestratorResult | null | undefined) => {
      notifyKeyRotationEffect({ result, addChatMessage });
    },
    [addChatMessage],
  );

  const announceRuntimeNote = useCallback(
    (result: OrchestratorResult | null | undefined) => {
      announceRuntimeNoteEffect({ result, addChatMessage });
    },
    [addChatMessage],
  );

  const announceContextBudgetNote = useCallback(
    (llmMessages: Array<{ role: string; content: string }>) => {
      announceContextBudgetNoteEffect({
        llmMessages,
        lastContextBudgetNoticeRef,
        addChatMessage,
      });
    },
    [addChatMessage],
  );

  const processAIRequest = useChatAIRequestController({
    config,
    addChatMessage,
    messagesRef,
    projectFilesRef,
    pendingPlanRef,
    inFlightRef,
    isMountedRef,
    abortControllerRef,
    setError,
    setIsAiLoading,
    setPendingPlan,
    setPendingChange,
    setShowConfirmModal,
    simulateStreaming,
    safe,
    sleepWithAbort,
    announceContextBudgetNote,
    notifyKeyRotation,
    announceRuntimeNote,
    drainAutoFixQueue,
  });

  processAIRequestRef.current = processAIRequest;

  const { applyChanges, rejectChanges } = useChatAIChangeLifecycle({
    pendingChange,
    safe,
    projectFilesRef,
    updateProjectFiles,
    addChatMessage,
    hardScrollToBottom,
    setShowConfirmModal,
    setPendingChange,
  });

  const handleSendWithMeta = useCallback(
    async (rawInput: string, aiInput: string = rawInput): Promise<boolean> => {
      const { userContent, candidateInput } = getNormalizedSendInputs(rawInput, aiInput);
      if (!userContent && !candidateInput) return false;

      const metaResult = userContent
        ? handleMetaCommand(userContent, projectFilesRef.current)
        : { handled: false };
      if (metaResult.handled && metaResult.message) {
        addChatMessage(buildUserMessage(userContent, { localOnly: true, metaCommand: true }));
        addChatMessage(metaResult.message);
        return true;
      }

      const validation = prepareValidatedChatInput(candidateInput);
      if (!validation.valid) {
        const validationMessage = getInputValidationMessage(validation.error);
        safe(() => setError(validationMessage));
        addChatMessage(buildAssistantMessage(validationMessage, { error: true }));
        return false;
      }

      const sanitizedAiContent = validation.sanitized;
      const sanitizedUserContent = userContent
        ? prepareValidatedChatInput(userContent).sanitized || userContent
        : sanitizedAiContent;

      if (!sanitizedAiContent) {
        safe(() => setError(getEmptyMessageNoticeText()));
        return false;
      }

      addChatMessage(buildUserMessage(sanitizedUserContent || sanitizedAiContent));

      if (validation.hadXSS) {
        addChatMessage(
          buildSystemMessage(getXssSanitizationNoticeText(), { validatorWarning: true }),
        );
      }

      const currentPlan = pendingPlanRef.current;
      if (currentPlan) {
        const handoff = resolvePendingPlanHandoff({
          currentPlan,
          sanitizedUserContent,
          sanitizedAiContent,
          isDirectBuildCommand,
        });

        if (handoff.kind === "hold") {
          addChatMessage(buildAssistantMessage(handoff.message));
          return true;
        }

        pendingPlanRef.current = null;
        safe(() => setPendingPlan(null));
        await processAIRequest(handoff.combinedRequest, false, true);
        return true;
      }

      return processAIRequest(sanitizedAiContent, false, false);
    },
    [addChatMessage, processAIRequest, safe, setError],
  );

  return useMemo(
    () => ({
      pendingPlan,
      pendingChange,
      isAtBottomRef,
      setAtBottom,
      handleSendWithMeta,
      applyChanges,
      rejectChanges,
      resetTransientState,
      handleScreenBlurCleanup,
    }),
    [
      applyChanges,
      handleScreenBlurCleanup,
      handleSendWithMeta,
      pendingChange,
      pendingPlan,
      rejectChanges,
      resetTransientState,
      setAtBottom,
    ],
  );
}
