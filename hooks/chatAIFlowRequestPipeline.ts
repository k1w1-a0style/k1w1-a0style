import type { AIConfig } from "../contexts/AIContext";
import { logger } from "../lib/logger";
import type { OrchestratorResult } from "../lib/orchestrator";
import type { PendingChange, PendingPlan } from "./chatAIFlowTypes";
import { buildIntentConfirmationMessage, buildPlannerPreviewMessage } from "./chatAIFlowPlannerMessageHelpers";
import { composePendingChange, computeMergeResult } from "./chatAIFlowPendingChangeComposer";
import {
  runBuilderWithRetry,
  runExplainStage,
  runValidatorIfEnabled,
  tryPlanChatRequest,
} from "./chatAIFlowRequestOrchestrator";
import { getSourceSummaryText, getValidatorFallbackWarning } from "./chatAIFlowStageHelpers";
import type { BuildPathBulletList } from "./chatAIFlowPendingChangeComposer";
import { classifyChatIntent } from "../utils/chatHeuristics";

export type RequestPipelineSideEffects = {
  announceContextBudgetNote: (messages: Array<{ role: string; content: string }>) => void;
  notifyKeyRotation: (result: OrchestratorResult | null | undefined) => void;
  announceRuntimeNote: (result: OrchestratorResult | null | undefined) => void;
  recordConfirmationPrompt: () => void;
  onExplainFailure: () => void;
  onValidatorWarning: (message: string) => void;
};

export type ExecuteRequestPipelineArgs = {
  config: AIConfig;
  sanitizedRequestContent: string;
  isAutoFix: boolean;
  forceBuilder: boolean;
  currentMessages: Parameters<typeof tryPlanChatRequest>[0]["currentMessages"];
  currentProjectFiles: Parameters<typeof tryPlanChatRequest>[0]["currentProjectFiles"];
  currentPendingPlan: PendingPlan | null;
  signal: AbortSignal;
  runOrchestratorWithTimeout: Parameters<typeof tryPlanChatRequest>[0]["runOrchestratorWithTimeout"];
  computeRetryDelayMs: Parameters<typeof runBuilderWithRetry>[0]["computeRetryDelayMs"];
  sleepWithAbort: Parameters<typeof runBuilderWithRetry>[0]["sleepWithAbort"];
  buildGuardPolicyPreHint: () => string;
  buildPreflightSummaryIntro: () => string;
  buildPathBulletList: BuildPathBulletList;
  sideEffects: RequestPipelineSideEffects;
};

export type RequestPipelineResult =
  | {
      kind: "confirmation_required";
      message: string;
    }
  | {
      kind: "planner_preview";
      message: string;
      pendingPlan: PendingPlan;
    }
  | {
      kind: "change_proposal";
      summaryText: string;
      pendingChange: PendingChange;
    };

export const shouldAttemptPlannerStage = ({
  isAutoFix,
  forceBuilder,
  hasPendingPlan,
}: {
  isAutoFix: boolean;
  forceBuilder: boolean;
  hasPendingPlan: boolean;
}): boolean => !isAutoFix && !forceBuilder && !hasPendingPlan;

export const executeChatRequestPipeline = async ({
  config,
  sanitizedRequestContent,
  isAutoFix,
  forceBuilder,
  currentMessages,
  currentProjectFiles,
  currentPendingPlan,
  signal,
  runOrchestratorWithTimeout,
  computeRetryDelayMs,
  sleepWithAbort,
  buildGuardPolicyPreHint,
  buildPreflightSummaryIntro,
  buildPathBulletList,
  sideEffects,
}: ExecuteRequestPipelineArgs): Promise<RequestPipelineResult> => {
  if (
    shouldAttemptPlannerStage({
      isAutoFix,
      forceBuilder,
      hasPendingPlan: currentPendingPlan !== null,
    })
  ) {
    const planner = await tryPlanChatRequest({
      config,
      currentMessages,
      currentProjectFiles,
      requestContent: sanitizedRequestContent,
      signal,
      runOrchestratorWithTimeout,
      sideEffects: {
        announceContextBudgetNote: sideEffects.announceContextBudgetNote,
        notifyKeyRotation: sideEffects.notifyKeyRotation,
        announceRuntimeNote: sideEffects.announceRuntimeNote,
      },
      recordConfirmationPrompt: sideEffects.recordConfirmationPrompt,
    });

    if (planner.requiresConfirmation) {
      const intentDecision = classifyChatIntent(sanitizedRequestContent);
      return {
        kind: "confirmation_required",
        message: buildIntentConfirmationMessage({
          intent: intentDecision.intent,
          confidence: intentDecision.confidence,
          reason: intentDecision.reason,
        }),
      };
    }

    if (planner.pendingPlan && planner.plannerText) {
      return {
        kind: "planner_preview",
        message: buildPlannerPreviewMessage(
          planner.plannerText,
          buildGuardPolicyPreHint(),
        ),
        pendingPlan: planner.pendingPlan,
      };
    }
  }

  const { ai, normalizedFiles } = await runBuilderWithRetry({
    config,
    requestContent: sanitizedRequestContent,
    currentMessages,
    currentProjectFiles,
    signal,
    runOrchestratorWithTimeout,
    computeRetryDelayMs,
    sleepWithAbort,
    sideEffects: {
      announceContextBudgetNote: sideEffects.announceContextBudgetNote,
      notifyKeyRotation: sideEffects.notifyKeyRotation,
      announceRuntimeNote: sideEffects.announceRuntimeNote,
    },
  });

  const { finalFiles, agentMeta, finalFileSource, validatorState } = await runValidatorIfEnabled({
    config,
    requestContent: sanitizedRequestContent,
    normalizedFiles,
    currentProjectFiles,
    signal,
    runOrchestratorWithTimeout,
    sideEffects: {
      notifyKeyRotation: sideEffects.notifyKeyRotation,
      addValidatorWarning: (validatorStateForMessage) => {
        const content = validatorStateForMessage
          ? getValidatorFallbackWarning(validatorStateForMessage)
          : null;
        if (!content) return;
        sideEffects.onValidatorWarning(content);
      },
    },
  });

  const sourceSummary = getSourceSummaryText(finalFileSource, config.agentEnabled);

  const mergeResult = computeMergeResult(currentProjectFiles, finalFiles);

  let explainText = "";
  if (!isAutoFix && mergeResult.created.length + mergeResult.updated.length > 0) {
    try {
      explainText = await runExplainStage({
        config,
        requestContent: sanitizedRequestContent,
        currentProjectFiles,
        mergedFiles: mergeResult.files,
        created: mergeResult.created,
        updated: mergeResult.updated,
        signal,
        runOrchestratorWithTimeout,
        notifyKeyRotation: sideEffects.notifyKeyRotation,
      });
    } catch (e) {
      logger.warn("[useChatAIFlow] Explain call failed:", e);
      sideEffects.onExplainFailure();
    }
  }

  const composedChange = composePendingChange({
    isAutoFix,
    currentProjectFiles,
    finalFiles,
    proposedFiles: finalFiles,
    aiResponse: ai,
    agentResponse: agentMeta,
    finalFileSource,
    validatorState,
    sourceSummary,
    explainText,
    preflightIntro: buildPreflightSummaryIntro(),
    buildPathBulletList,
  });

  return {
    kind: "change_proposal",
    summaryText: composedChange.summaryText,
    pendingChange: composedChange.pendingChange,
  };
};
