import type { AIConfig } from "../contexts/AIContext";
import type { AllAIProviders } from "../contexts/AIContext";
import type { OrchestratorResult, LlmMessage } from "../lib/orchestrator";
import type { Quality } from "../lib/orchestrator/types";
import { logger } from "../lib/logger";
import { buildBuilderMessages, buildPlannerMessages, buildValidatorMessages } from "../lib/promptEngine";
import { buildSanitizedLlmHistory } from "../lib/promptSanitizer";
import { buildChangeDigest, buildExplainMessages, classifyChatIntent, looksLikeScoutModeRequest } from "../utils/chatHeuristics";
import { extractRawOrchestratorResult, type ExtendedOrchestratorResult, type PendingChange, type PendingPlan } from "./chatAIFlowTypes";
import { normalizeResultFiles, readBuilderFilesOrThrow } from "./chatAIFlowResultHelpers";
import { shouldRetryBuilderAttempt, readOrchestratorErrorText } from "./useChatAIFlowRetryHelpers";
import type { ChatMessage } from "../shared/types/chat";
import type { ProjectFile } from "../shared/types/project";

export const BUILDER_RETRY_MAX_ATTEMPTS = 3;

type RunOrchestratorWithTimeout = (
  provider: AllAIProviders,
  model: string,
  quality: Quality,
  messages: LlmMessage[],
  signal?: AbortSignal,
) => Promise<OrchestratorResult>;

type RequestSideEffects = {
  announceContextBudgetNote: (messages: Array<{ role: string; content: string }>) => void;
  notifyKeyRotation: (result: OrchestratorResult | null | undefined) => void;
  announceRuntimeNote: (result: OrchestratorResult | null | undefined) => void;
  addValidatorWarning: (validatorStateForMessage: PendingChange["validatorState"]) => void;
};

export const tryPlanChatRequest = async ({
  config,
  currentMessages,
  currentProjectFiles,
  requestContent,
  signal,
  runOrchestratorWithTimeout,
  sideEffects,
  recordConfirmationPrompt,
}: {
  config: AIConfig;
  currentMessages: ChatMessage[];
  currentProjectFiles: ProjectFile[];
  requestContent: string;
  signal?: AbortSignal;
  runOrchestratorWithTimeout: RunOrchestratorWithTimeout;
  sideEffects: Pick<RequestSideEffects, "announceContextBudgetNote" | "notifyKeyRotation" | "announceRuntimeNote">;
  recordConfirmationPrompt: () => void;
}): Promise<{ requiresConfirmation: boolean; pendingPlan: PendingPlan | null; plannerText: string | null }> => {
  const historyAsLlm = buildSanitizedLlmHistory(currentMessages);
  const scoutOnly = looksLikeScoutModeRequest(requestContent);
  const intentDecision = classifyChatIntent(requestContent);
  const advice = intentDecision.intent === "advice";
  const shouldPlanner = scoutOnly || intentDecision.intent !== "builder";

  if (intentDecision.requiresConfirmation) {
    recordConfirmationPrompt();
    return { requiresConfirmation: true, pendingPlan: null, plannerText: null };
  }

  if (!shouldPlanner) {
    return { requiresConfirmation: false, pendingPlan: null, plannerText: null };
  }

  const plannerMsgs = buildPlannerMessages(
    historyAsLlm,
    requestContent,
    currentProjectFiles,
    config.selectedChatProvider,
  );
  sideEffects.announceContextBudgetNote(plannerMsgs);

  const planRes = await runOrchestratorWithTimeout(
    config.selectedChatProvider,
    config.selectedChatMode,
    "speed",
    plannerMsgs,
    signal,
  );

  sideEffects.notifyKeyRotation(planRes);
  sideEffects.announceRuntimeNote(planRes);

  if (!planRes?.ok || typeof planRes.text !== "string" || planRes.text.trim().length < 1) {
    return { requiresConfirmation: false, pendingPlan: null, plannerText: null };
  }

  const planText = planRes.text.trim();
  return {
    requiresConfirmation: false,
    plannerText: planText,
    pendingPlan: {
      originalRequest: requestContent,
      planText,
      mode: scoutOnly ? "scout" : advice ? "advice" : "build",
    },
  };
};

export const runBuilderWithRetry = async ({
  config,
  requestContent,
  currentMessages,
  currentProjectFiles,
  signal,
  runOrchestratorWithTimeout,
  computeRetryDelayMs,
  sleepWithAbort,
  sideEffects,
}: {
  config: AIConfig;
  requestContent: string;
  currentMessages: ChatMessage[];
  currentProjectFiles: ProjectFile[];
  signal?: AbortSignal;
  runOrchestratorWithTimeout: RunOrchestratorWithTimeout;
  computeRetryDelayMs: (attempt: number, errorText: string) => number;
  sleepWithAbort: (ms: number, signal?: AbortSignal) => Promise<void>;
  sideEffects: Pick<RequestSideEffects, "announceContextBudgetNote" | "notifyKeyRotation" | "announceRuntimeNote">;
}): Promise<{ ai: OrchestratorResult; normalizedFiles: ProjectFile[]; historyAsLlm: LlmMessage[] }> => {
  const historyAsLlm = buildSanitizedLlmHistory(currentMessages);
  const llmMessages = buildBuilderMessages(
    historyAsLlm,
    requestContent,
    currentProjectFiles,
    config.selectedChatProvider,
  );
  sideEffects.announceContextBudgetNote(llmMessages);

  let ai: OrchestratorResult | null = null;
  for (let attempt = 1; attempt <= BUILDER_RETRY_MAX_ATTEMPTS; attempt += 1) {
    ai = await runOrchestratorWithTimeout(
      config.selectedChatProvider,
      config.selectedChatMode,
      config.qualityMode,
      llmMessages,
      signal,
    );

    sideEffects.notifyKeyRotation(ai);
    sideEffects.announceRuntimeNote(ai);

    if (ai?.ok) break;

    const errText = readOrchestratorErrorText(ai);
    const shouldRetry = shouldRetryBuilderAttempt({
      attempt,
      maxAttempts: BUILDER_RETRY_MAX_ATTEMPTS,
      errorText: errText,
    });
    if (!shouldRetry) break;

    const backoffMs = computeRetryDelayMs(attempt, errText);
    logger.warn(
      `[useChatAIFlow] Builder retry ${attempt}/${BUILDER_RETRY_MAX_ATTEMPTS - 1} in ${backoffMs}ms: ${errText.slice(0, 220)}`,
    );
    await sleepWithAbort(backoffMs, signal);
  }

  if (!ai || !ai.ok) {
    throw new Error(`builder_non_ok:${readOrchestratorErrorText(ai)}`);
  }

  const rawForNormalizer = extractRawOrchestratorResult(ai as ExtendedOrchestratorResult);
  const normalizedResult = normalizeResultFiles(rawForNormalizer);
  const normalizedFiles = readBuilderFilesOrThrow(normalizedResult, ai.text ?? "");

  return { ai, normalizedFiles, historyAsLlm };
};

export const runValidatorIfEnabled = async ({
  config,
  requestContent,
  normalizedFiles,
  currentProjectFiles,
  signal,
  runOrchestratorWithTimeout,
  sideEffects,
}: {
  config: AIConfig;
  requestContent: string;
  normalizedFiles: ProjectFile[];
  currentProjectFiles: ProjectFile[];
  signal?: AbortSignal;
  runOrchestratorWithTimeout: RunOrchestratorWithTimeout;
  sideEffects: Pick<RequestSideEffects, "notifyKeyRotation" | "addValidatorWarning">;
}): Promise<{
  finalFiles: ProjectFile[];
  agentMeta: OrchestratorResult | null;
  finalFileSource: PendingChange["finalFileSource"];
  validatorState: PendingChange["validatorState"];
}> => {
  let finalFiles = normalizedFiles;
  let agentMeta: OrchestratorResult | null = null;
  let finalFileSource: PendingChange["finalFileSource"] = "builder";
  let validatorState: PendingChange["validatorState"] = config.agentEnabled ? "builder-fallback-empty" : "disabled";

  if (!config.agentEnabled) {
    return { finalFiles, agentMeta, finalFileSource, validatorState };
  }

  try {
    const validatorMsgs = buildValidatorMessages(
      requestContent,
      normalizedFiles.map((f) => ({ path: f.path, content: f.content })),
      currentProjectFiles,
      config.selectedAgentProvider ?? config.selectedChatProvider,
    );

    const agentRes = await runOrchestratorWithTimeout(
      config.selectedAgentProvider ?? config.selectedChatProvider,
      config.selectedAgentMode ?? config.selectedChatMode,
      "quality",
      validatorMsgs,
      signal,
    );

    sideEffects.notifyKeyRotation(agentRes);

    if (agentRes?.ok) {
      const agentRaw = extractRawOrchestratorResult(agentRes as ExtendedOrchestratorResult);
      const normalizedAgent = normalizeResultFiles(agentRaw).files;
      if (normalizedAgent && normalizedAgent.length > 0) {
        finalFiles = normalizedAgent;
        agentMeta = agentRes;
        finalFileSource = "validator";
        validatorState = "validated";
      } else {
        logger.warn("[useChatAIFlow] Validator returned no valid file array; keeping builder files.");
        validatorState = "builder-fallback-empty";
        sideEffects.addValidatorWarning(validatorState);
      }
    } else if (agentRes) {
      logger.warn("[useChatAIFlow] Validator returned non-ok result:", agentRes.error);
      validatorState = "builder-fallback-error";
      sideEffects.addValidatorWarning(validatorState);
    }
  } catch (e) {
    logger.warn("[useChatAIFlow] Agent/Validator call failed:", e);
    validatorState = "builder-fallback-exception";
    sideEffects.addValidatorWarning(validatorState);
  }

  return { finalFiles, agentMeta, finalFileSource, validatorState };
};

export const runExplainStage = async ({
  config,
  requestContent,
  currentProjectFiles,
  mergedFiles,
  created,
  updated,
  signal,
  runOrchestratorWithTimeout,
  notifyKeyRotation,
}: {
  config: AIConfig;
  requestContent: string;
  currentProjectFiles: ProjectFile[];
  mergedFiles: ProjectFile[];
  created: string[];
  updated: string[];
  signal?: AbortSignal;
  runOrchestratorWithTimeout: RunOrchestratorWithTimeout;
  notifyKeyRotation: (res: OrchestratorResult | null | undefined) => void;
}): Promise<string> => {
  const hasChanges = created.length + updated.length > 0;
  if (!hasChanges) return "";

  const digest = buildChangeDigest(
    currentProjectFiles,
    mergedFiles,
    created,
    updated,
  );
  const explainMsgs = buildExplainMessages(requestContent, digest);
  const explainRes = await runOrchestratorWithTimeout(
    config.selectedChatProvider,
    config.selectedChatMode,
    "speed",
    explainMsgs,
    signal,
  );

  notifyKeyRotation(explainRes);
  if (explainRes?.ok && typeof explainRes.text === "string") {
    return explainRes.text.trim();
  }

  return "";
};
