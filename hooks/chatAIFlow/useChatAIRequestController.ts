import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AIConfig } from "../../contexts/AIContext";
import type { OrchestratorResult } from "../../lib/orchestrator";
import { recordChatQualityMetric } from "../../lib/chatQualityMetrics";
import { executeChatRequestPipeline } from "../chatAIFlowRequestPipeline";
import {
  buildRequestFailureNotice,
  finalizeRequestCycle,
  isAbortLikeError,
} from "../chatAIFlowRequestLifecycleStageHelpers";
import { handlePipelineResult } from "../chatAIFlowRequestResultHandlers";
import { getInputValidationMessage } from "../chatAIFlowNoticeHelpers";
import { getExplainFallbackNoticeText } from "../chatAIFlowNoticeMessageHelpers";
import {
  buildAssistantMessage,
  buildSystemMessage,
} from "../chatAIFlowChatMessageFactory";
import {
  buildGuardPolicyPreHint,
  buildPathBulletList,
  buildPreflightSummaryIntro,
  computeBuilderRetryDelayMs,
  isDirectBuildCommand,
  prepareValidatedChatInput,
  runOrchestratorWithHardTimeout,
} from "./chatAIFlowPureHelpers";
import { inferStagedTotalBlocksFromPlan } from "../chatAIFlowInputRoutingHelpers";
import type { PendingChange, PendingPlan } from "./chatAIFlow.contracts";
import type { ChatMessage } from "../../shared/types/chat";
import type { ProjectFile } from "../../shared/types/project";

export type UseChatAIRequestControllerArgs = {
  config: AIConfig;
  addChatMessage: (message: ChatMessage) => void;
  messagesRef: MutableRefObject<ChatMessage[]>;
  projectFilesRef: MutableRefObject<ProjectFile[]>;
  pendingPlanRef: MutableRefObject<PendingPlan | null>;
  inFlightRef: MutableRefObject<boolean>;
  isMountedRef: MutableRefObject<boolean>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  setError: (value: string | null) => void;
  setIsAiLoading: (value: boolean) => void;
  setPendingPlan: Dispatch<SetStateAction<PendingPlan | null>>;
  setPendingChange: Dispatch<SetStateAction<PendingChange | null>>;
  setShowConfirmModal: (value: boolean) => void;
  simulateStreaming: (fullText: string, onComplete: () => void) => void;
  safe: <T>(fn: () => T) => T | undefined;
  sleepWithAbort: (ms: number, signal?: AbortSignal) => Promise<void>;
  announceContextBudgetNote: (messages: Array<{ role: string; content: string }>) => void;
  notifyKeyRotation: (result: OrchestratorResult | null | undefined) => void;
  announceRuntimeNote: (result: OrchestratorResult | null | undefined) => void;
  drainAutoFixQueue: () => void;
  activeProjectIdRef: MutableRefObject<string | null>;
  projectRequestVersionRef: MutableRefObject<number>;
  activeRequestIdRef: MutableRefObject<number>;
};

export const useChatAIRequestController = ({
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
  activeProjectIdRef,
  projectRequestVersionRef,
  activeRequestIdRef,
}: UseChatAIRequestControllerArgs) => {
  return useCallback(
    async (userContent: string, isAutoFix = false, forceBuilder = false) => {
      if (inFlightRef.current) return false;

      const preparedInput = prepareValidatedChatInput(userContent);
      if (!preparedInput.valid) {
        const validationMessage = getInputValidationMessage(preparedInput.error);
        safe(() => setError(validationMessage));
        addChatMessage(buildAssistantMessage(validationMessage, { error: true }));
        return false;
      }

      const sanitizedRequestContent = preparedInput.sanitized;
      const normalizedIntentReply = sanitizedRequestContent.trim().toLowerCase();
      if (normalizedIntentReply === "planen") {
        void recordChatQualityMetric("intent_confirmation_planen");
      } else if (isDirectBuildCommand(normalizedIntentReply)) {
        void recordChatQualityMetric("intent_confirmation_build");
      }

      inFlightRef.current = true;
      safe(() => setIsAiLoading(true));
      safe(() => setError(null));

      const controller = new AbortController();
      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;
      const requestProjectId = activeProjectIdRef.current;
      const requestVersion = projectRequestVersionRef.current;
      abortControllerRef.current?.abort();
      abortControllerRef.current = controller;

      try {
        const pipelineResult = await executeChatRequestPipeline({
          config,
          sanitizedRequestContent,
          isAutoFix,
          forceBuilder,
          currentMessages: messagesRef.current,
          currentProjectFiles: projectFilesRef.current,
          currentPendingPlan: pendingPlanRef.current,
          signal: controller.signal,
          runOrchestratorWithTimeout: runOrchestratorWithHardTimeout,
          computeRetryDelayMs: computeBuilderRetryDelayMs,
          sleepWithAbort,
          buildGuardPolicyPreHint,
          buildPreflightSummaryIntro,
          buildPathBulletList,
          sideEffects: {
            announceContextBudgetNote,
            notifyKeyRotation,
            announceRuntimeNote,
            recordConfirmationPrompt: () => {
              void recordChatQualityMetric("intent_confirmation_prompt");
            },
            onExplainFailure: () => {
              addChatMessage(
                buildSystemMessage(getExplainFallbackNoticeText(), {
                  explainWarning: true,
                }),
              );
            },
            onValidatorWarning: (message) => {
              addChatMessage(buildSystemMessage(message, { validatorWarning: true }));
            },
          },
        });

        const projectScopeStillValid =
          activeProjectIdRef.current === requestProjectId &&
          projectRequestVersionRef.current === requestVersion;
        if (!projectScopeStillValid || controller.signal.aborted) return false;

        const scopedPipelineResult =
          pipelineResult.kind === "planner_preview"
            ? {
                ...pipelineResult,
                pendingPlan: {
                  ...pipelineResult.pendingPlan,
                  originProjectId: requestProjectId,
                  stagedLastBlockIndex:
                    pipelineResult.pendingPlan.mode === "staged" ? 0 : undefined,
                  stagedNextBlockIndex:
                    pipelineResult.pendingPlan.mode === "staged" ? 1 : undefined,
                  stagedTotalBlocks:
                    pipelineResult.pendingPlan.mode === "staged"
                      ? inferStagedTotalBlocksFromPlan(pipelineResult.pendingPlan.planText) ?? undefined
                      : undefined,
                },
              }
            : pipelineResult.kind === "change_proposal"
              ? {
                  ...pipelineResult,
                  pendingChange: {
                    ...pipelineResult.pendingChange,
                    originProjectId: requestProjectId,
                  },
                }
              : pipelineResult;

        handlePipelineResult({
          pipelineResult: scopedPipelineResult,
          addChatMessage,
          pendingPlanRef,
          setPendingPlan,
          safe,
          simulateStreaming,
          setPendingChange,
          setShowConfirmModal,
        });

        return true;
      } catch (e: unknown) {
        if (!isMountedRef.current) return false;

        const error = e instanceof Error ? e : new Error(String(e));
        if (isAbortLikeError(error)) return false;

        const message = buildRequestFailureNotice(error);
        safe(() => setError(message));
        addChatMessage(buildAssistantMessage(message, { error: true }));
        return false;
      } finally {
        finalizeRequestCycle({
          safe,
          setIsAiLoading,
          inFlightRef,
          abortControllerRef,
          requestController: controller,
          requestId,
          activeRequestIdRef,
          isMountedRef,
          drainAutoFixQueue,
        });
      }
    },
    [
      abortControllerRef,
      activeProjectIdRef,
      activeRequestIdRef,
      addChatMessage,
      announceContextBudgetNote,
      announceRuntimeNote,
      config,
      drainAutoFixQueue,
      inFlightRef,
      isMountedRef,
      messagesRef,
      notifyKeyRotation,
      pendingPlanRef,
      projectFilesRef,
      projectRequestVersionRef,
      safe,
      setError,
      setIsAiLoading,
      setPendingChange,
      setPendingPlan,
      setShowConfirmModal,
      simulateStreaming,
      sleepWithAbort,
    ],
  );
};
