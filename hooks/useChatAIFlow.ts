// hooks/useChatAIFlow.ts
// REFACTORED: types + helpers → chatAIFlowTypes.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import type { LlmMessage, OrchestratorResult } from "../lib/orchestrator";
import type { Quality } from "../lib/orchestrator/types";
import { MAX_AUTOFIX_QUEUE } from "./chatAIFlowTypes";
import type { UseChatAIFlowArgs, PendingChange, PendingPlan } from "./chatAIFlowTypes";
import { buildChangeConfirmationText } from "./chatChangeSummary";

import { runOrchestrator } from "../lib/orchestrator";
import type { AllAIProviders } from "../contexts/AIContext";
import { logger } from "../lib/logger";
import { rebasePendingChangeOnLatest } from "../lib/chatFlowStateGuards";
import { validateChatInput } from "../lib/validators";

import { recordChatQualityMetric } from "../lib/chatQualityMetrics";
import { handleMetaCommand } from "../utils/metaCommands";
import {
  buildAssistantMessage,
  buildSystemMessage,
  buildUserMessage,
} from "./chatAIFlowChatMessageFactory";
import { getInputValidationMessage } from "./chatAIFlowNoticeHelpers";
import {
  getEmptyMessageNoticeText,
  getExplainFallbackNoticeText,
  getXssSanitizationNoticeText,
} from "./chatAIFlowNoticeMessageHelpers";
import {
  getNormalizedSendInputs,
} from "./chatAIFlowInputRoutingHelpers";
import { executeChatRequestPipeline } from "./chatAIFlowRequestPipeline";
import {
  buildRequestFailureNotice,
  finalizeRequestCycle,
  isAbortLikeError,
} from "./chatAIFlowRequestLifecycleStageHelpers";
import {
  getScreenBlurAbortNotice,
  hasPreservedPendingState,
  shouldAbortOnScreenBlur,
} from "./chatAIFlowLifecycleHelpers";
import {
  clearInFlightTransientState,
  clearPendingDecisionState,
  resetTransientUiState,
} from "./chatAIFlowTransientStateHelpers";
import { parseRetryAfterMs } from "./useChatAIFlowRetryHelpers";
import {
  announceContextBudgetNoteEffect,
  announceRuntimeNoteEffect,
  notifyKeyRotationEffect,
} from "./chatAIFlowRequestSideEffects";
import { handlePipelineResult } from "./chatAIFlowRequestResultHandlers";
import {
  buildSendValidationErrorMessage,
  handlePendingPlanDecision,
  resolveSanitizedUserContent,
} from "./chatAIFlowSendFlowHelpers";

export type { PendingChange, PendingPlan } from "./chatAIFlowTypes";
export { extractContextBudgetNotice } from "./chatAIFlowContextBudgetHelpers";

const BUILDER_RETRY_BACKOFF_MS = 700;
const BUILDER_RETRY_MAX_BACKOFF_MS = 3_500;
export const CHAT_AI_REQUEST_TIMEOUT_MS = 45_000;

export const computeBuilderRetryDelayMs = (
  attempt: number,
  errorText: string,
): number => {
  const retryAfterMs = parseRetryAfterMs(errorText);
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, BUILDER_RETRY_MAX_BACKOFF_MS);
  }

  const exponential = BUILDER_RETRY_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = 0.9 + Math.random() * 0.2;
  return Math.min(Math.round(exponential * jitter), BUILDER_RETRY_MAX_BACKOFF_MS);
};

export async function runOrchestratorWithHardTimeout(
  provider: AllAIProviders,
  model: string,
  quality: Quality,
  messages: LlmMessage[],
  signal?: AbortSignal,
  timeoutMs = CHAT_AI_REQUEST_TIMEOUT_MS,
): Promise<OrchestratorResult> {
  if (signal?.aborted) {
    return { ok: false, error: "Request abgebrochen" };
  }

  const requestController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, timeoutMs);

  const onAbort = () => requestController.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const result = await runOrchestrator(
      provider,
      model,
      quality,
      messages,
      requestController.signal,
    );

    if (timedOut && !result.ok) {
      return {
        ...result,
        error: `Request timeout nach ${timeoutMs}ms`,
      };
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
}

export const prepareValidatedChatInput = (
  input: string,
): { valid: boolean; error?: string; sanitized: string; hadXSS: boolean } => {
  const validation = validateChatInput(input);
  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
      sanitized: "",
      hadXSS: Boolean(validation.hadXSS),
    };
  }

  const sanitized = String(validation.sanitized ?? input).trim();
  return {
    valid: sanitized.length > 0,
    error: sanitized.length > 0 ? undefined : "Nachricht ist leer",
    sanitized,
    hadXSS: Boolean(validation.hadXSS),
  };
};

export const buildPathBulletList = (
  paths: string[],
  previewLimit: number,
): string => {
  if (!paths.length) return "  (keine)";

  const preview = paths
    .slice(0, previewLimit)
    .map((filePath: string) => `  • ${filePath}`)
    .join("\n");

  if (paths.length > previewLimit) {
    return `${preview}\n  ... und ${paths.length - previewLimit} weitere`;
  }

  return preview;
};

export const buildPreflightSummaryIntro = (): string =>
  "📦 **Pre-Flight (voraussichtlich):**\n" +
  "Ich zeige gleich strukturiert, welche Dateien neu/aktualisiert werden und welche Pfade manuell bleiben.";

export const buildGuardPolicyPreHint = (): string =>
  "🛡️ **Guard-Policy vor Vorschlag:**\n" +
  "🟢 `allowed` = kann ich direkt als Patch vorschlagen\n" +
  "🔴 `guarded` = kritische/manual-only Pfade, bleiben manuell";

export const isDirectBuildCommand = (input: string): boolean => {
  const lower = String(input ?? "").trim().toLowerCase();
  return lower === "direkt build" || lower === "build" || lower === "jetzt builden";
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
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(
    null,
  );

  const isAtBottomRef = useRef(true);
  const lastContextBudgetNoticeRef = useRef("");

  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const processAIRequestRef = useRef<
    ((m: string, isAutoFix?: boolean, forceBuilder?: boolean) => Promise<boolean>) | null
  >(null);

  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingRunIdRef = useRef(0);

  // ✅ FIX #1: Keep fresh references to avoid stale closures in AutoFix queue
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const projectFilesRef = useRef(projectFiles);
  projectFilesRef.current = projectFiles;

  const pendingPlanRef = useRef(pendingPlan);
  pendingPlanRef.current = pendingPlan;

  const pendingChangeRef = useRef(pendingChange);
  pendingChangeRef.current = pendingChange;

  // ✅ FIX #3: AutoFix FIFO Queue with max limit
  const queuedAutoFixRef = useRef<string[]>([]);

  const safe = useCallback(<T>(fn: () => T): T | undefined => {
    if (!isMountedRef.current) return undefined;
    return fn();
  }, []);

  const setAtBottom = useCallback((v: boolean) => {
    isAtBottomRef.current = v;
  }, []);

  const cleanupStreamingTimer = useCallback(() => {
    if (streamingTimerRef.current) {
      clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }
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

  // ✅ FIX #2: Cleanup streaming timer on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      cleanupStreamingTimer();
      streamingRunIdRef.current += 1;
      inFlightRef.current = false;
    };
  }, [cleanupStreamingTimer]);

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
          const nextChunk = fullText.slice(
            currentIndex,
            currentIndex + chunkSize,
          );
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
    [
      cleanupStreamingTimer,
      hardScrollToBottom,
      safe,
      setIsStreaming,
      setStreamingMessage,
    ],
  );

  const drainAutoFixQueue = useCallback(() => {
    if (inFlightRef.current) return;

    const msg = queuedAutoFixRef.current.shift();
    if (!msg) return;

    addChatMessage(buildUserMessage(msg, { autoFix: true }));

    const runner = processAIRequestRef.current;
    if (runner) void runner(msg, true, true);
  }, [addChatMessage]);

  // AutoFix → FIFO Queue + drain
  useEffect(() => {
    const msg = autoFixRequest?.message;
    if (!msg) return;

    // ✅ FIX #3: Prevent unbounded queue growth
    if (queuedAutoFixRef.current.length >= MAX_AUTOFIX_QUEUE) {
      logger.warn(
        `[useChatAIFlow] AutoFix queue full (${MAX_AUTOFIX_QUEUE}), dropping: ${msg.slice(0, 80)}`,
      );
      clearAutoFixRequest();
      return;
    }

    queuedAutoFixRef.current.push(msg);
    clearAutoFixRequest();
    drainAutoFixQueue();
  }, [autoFixRequest, clearAutoFixRequest, drainAutoFixQueue]);

  const notifyKeyRotation = useCallback(
    (res: OrchestratorResult | null | undefined) => {
      notifyKeyRotationEffect({ result: res, addChatMessage });
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

  const processAIRequest = useCallback(
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
      abortControllerRef.current?.abort();
      abortControllerRef.current = controller;

      try {
        const currentMessages = messagesRef.current;
        const currentProjectFiles = projectFilesRef.current;
        const currentPendingPlan = pendingPlanRef.current;

        const pipelineResult = await executeChatRequestPipeline({
          config,
          sanitizedRequestContent,
          isAutoFix,
          forceBuilder,
          currentMessages,
          currentProjectFiles,
          currentPendingPlan,
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
                buildSystemMessage(getExplainFallbackNoticeText(), { explainWarning: true }),
              );
            },
            onValidatorWarning: (message) => {
              addChatMessage(buildSystemMessage(message, { validatorWarning: true }));
            },
          },
        });

        handlePipelineResult({
          pipelineResult,
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
        if (isAbortLikeError(error)) {
          return false;
        }

        const msg = buildRequestFailureNotice(error);
        safe(() => setError(msg));

        addChatMessage(buildAssistantMessage(msg, { error: true }));

        return false;
      } finally {
        finalizeRequestCycle({
          safe,
          setIsAiLoading,
          inFlightRef,
          abortControllerRef,
          requestController: controller,
          isMountedRef,
          drainAutoFixQueue,
        });
      }
    },
    [
      addChatMessage,
      announceContextBudgetNote,
      announceRuntimeNote,
      config,
      drainAutoFixQueue,
      notifyKeyRotation,
      safe,
      sleepWithAbort,
      setError,
      setIsAiLoading,
      setShowConfirmModal,
      simulateStreaming,
    ],
  );

  // Keep latest runner for AutoFix queue
  processAIRequestRef.current = processAIRequest;

  const applyChanges = useCallback(async () => {
    if (!pendingChange) return;

    safe(() => setShowConfirmModal(false));

    try {
      const latestProjectFiles = projectFilesRef.current;
      const { applyResult, driftDetected } = rebasePendingChangeOnLatest(
        latestProjectFiles,
        pendingChange,
      );

      await updateProjectFiles(applyResult.files);

      if (driftDetected) {
        addChatMessage(
          buildSystemMessage(
            "ℹ️ Projektzustand hat sich seit dem KI-Vorschlag geändert. Änderungen wurden auf den aktuellen Stand neu angewendet.",
            { stateDrift: true },
          ),
        );
      }

      const confirmationText = buildChangeConfirmationText({
        ...pendingChange,
        files: applyResult.files,
        created: applyResult.created,
        updated: applyResult.updated,
        skipped: applyResult.skipped,
        errors: applyResult.errors ?? pendingChange.errors,
      });

      addChatMessage(
        buildAssistantMessage(confirmationText, {
          provider: pendingChange.aiResponse?.provider || "system",
        }),
      );

      requestAnimationFrame(() => hardScrollToBottom(true));
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      Alert.alert(
        "Fehler beim Anwenden",
        error.message || "Änderungen konnten nicht angewendet werden.",
      );
      addChatMessage(
        buildSystemMessage(
          `⚠️ Fehler beim Anwenden der Änderungen: ${error.message || "Unbekannt"}`,
          { error: true },
        ),
      );
    } finally {
      safe(() => setPendingChange(null));
    }
  }, [
    addChatMessage,
    hardScrollToBottom,
    pendingChange,
    safe,
    setShowConfirmModal,
    updateProjectFiles,
  ]);

  const rejectChanges = useCallback(() => {
    addChatMessage(
      buildSystemMessage("❌ Änderungen wurden abgelehnt. Keine Dateien wurden geändert."),
    );
    safe(() => setShowConfirmModal(false));
    safe(() => setPendingChange(null));
  }, [addChatMessage, safe, setShowConfirmModal]);

  const handleSendWithMeta = useCallback(
    async (
      rawInput: string,
      aiInput: string = rawInput,
    ): Promise<boolean> => {
      const { userContent, candidateInput } = getNormalizedSendInputs(rawInput, aiInput);

      // Regression-Hinweis für Attachment-only-Pfade:
      // if (!userContent && !aiContent) return false;
      if (!userContent && !candidateInput) return false;

      // Meta-/lokale Kommandos müssen auf unverändertem User-Input laufen.
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
        const validationMessage = buildSendValidationErrorMessage(validation.error);

        safe(() => setError(validationMessage));
        addChatMessage(buildAssistantMessage(validationMessage, { error: true }));
        return false;
      }

      const sanitizedAiContent = validation.sanitized;
      const sanitizedUserContent = resolveSanitizedUserContent({
        userContent,
        sanitizedAiContent,
        sanitizeInput: prepareValidatedChatInput,
      });

      if (!sanitizedAiContent) {
        safe(() => setError(getEmptyMessageNoticeText()));
        return false;
      }

      addChatMessage(
        buildUserMessage(
          // Regression-Hinweis: content: userContent || aiContent,
          sanitizedUserContent || sanitizedAiContent,
        ),
      );

      if (validation.hadXSS) {
        addChatMessage(
          buildSystemMessage(getXssSanitizationNoticeText(), { validatorWarning: true }),
        );
      }

      // ✅ FIX #1: Use ref for fresh pendingPlan
      const pendingPlanHandled = await handlePendingPlanDecision({
        currentPlan: pendingPlanRef.current,
        sanitizedUserContent,
        sanitizedAiContent,
        isDirectBuildCommand,
        clearPendingPlan: () => {
          pendingPlanRef.current = null;
          safe(() => setPendingPlan(null));
        },
        addAssistantMessage: (message) => {
          addChatMessage(buildAssistantMessage(message));
        },
        processRequest: async (request) => {
          await processAIRequest(request, false, true);
        },
      });
      if (pendingPlanHandled) return true;

      // Regression-Hinweis: const ok = await processAIRequest(aiContent || userContent, false, false);
      const ok = await processAIRequest(sanitizedAiContent, false, false);
      return ok;
    },
    [addChatMessage, processAIRequest, safe, setError],
  );

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
    cleanupStreamingTimer,
    safe,
    setIsAiLoading,
    setIsStreaming,
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
      buildSystemMessage(
        getScreenBlurAbortNotice(preservedPendingState),
        {
          requestAbortedOnBlur: true,
          preservedPendingState,
        },
      ),
    );
  }, [
    addChatMessage,
    cleanupStreamingTimer,
    safe,
    setIsAiLoading,
    setIsStreaming,
    setStreamingMessage,
  ]);

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
