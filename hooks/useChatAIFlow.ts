// hooks/useChatAIFlow.ts
// REFACTORED: types + helpers → chatAIFlowTypes.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";
import { v4 as uuidv4 } from "uuid";
import type { LlmMessage, OrchestratorResult } from "../lib/orchestrator";
import type { Quality } from "../lib/orchestrator/types";
import type { ApplyFilesResult } from "../lib/fileWriter";
import { extractRawOrchestratorResult, MAX_AUTOFIX_QUEUE } from "./chatAIFlowTypes";
import type { ExtendedOrchestratorResult, UseChatAIFlowArgs, PendingChange, PendingPlan } from "./chatAIFlowTypes";
import { buildChangeConfirmationText } from "./chatChangeSummary";

import { runOrchestrator } from "../lib/orchestrator";
import type { AllAIProviders } from "../contexts/AIContext";
import { logger } from "../lib/logger";
import { applyFilesToProject } from "../lib/fileWriter";
import { buildProjectStateDigest, rebasePendingChangeOnLatest } from "../lib/chatFlowStateGuards";
import { buildChangePreviews } from "../lib/changePreview";
import { validateChatInput } from "../lib/validators";
import { buildBuilderMessages, buildPlannerMessages, buildValidatorMessages } from "../lib/promptEngine";
import { buildSanitizedLlmHistory } from "../lib/promptSanitizer";
import { looksLikeExplicitFileTask, looksLikeAdviceRequest, looksAmbiguousBuilderRequest, buildChangeDigest, buildExplainMessages } from "../utils/chatHeuristics";
import { handleMetaCommand } from "../utils/metaCommands";
import { normalizeResultFiles, readBuilderFilesOrThrow } from "./chatAIFlowResultHelpers";
import { getSourceSummaryText, getValidatorFallbackWarning } from "./chatAIFlowStageHelpers";
import { getBuilderFailureMessage, getInputValidationMessage } from "./chatAIFlowNoticeHelpers";
import {
  parseRetryAfterMs,
  readOrchestratorErrorText,
  readOrchestratorRuntimeNote,
  shouldRetryBuilderAttempt,
} from "./useChatAIFlowRetryHelpers";

export type { PendingChange, PendingPlan } from "./chatAIFlowTypes";

const BUILDER_RETRY_BACKOFF_MS = 700;
const BUILDER_RETRY_MAX_ATTEMPTS = 3;
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

    addChatMessage({
      id: uuidv4(),
      role: "user",
      content: msg,
      timestamp: new Date().toISOString(),
      meta: { autoFix: true },
    });

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
      if (!res) return;
      const count = res.keysRotated ?? 0;
      if (count <= 0) return;

      const provider = res.provider ?? "unbekannt";
      const msg = `🔑 Key rotiert (${count}x) wegen 429/Rate-Limit • Provider: ${provider}`;

      try {
        if (Platform.OS === "android") {
          ToastAndroid.show(msg, ToastAndroid.LONG);
        }
      } catch (e) {
        logger.warn("[notifyKeyRotation] Toast failed:", e);
      }

      addChatMessage({
        id: uuidv4(),
        role: "system",
        content: msg,
        timestamp: new Date().toISOString(),
        meta: { keyRotation: true, provider },
      });
    },
    [addChatMessage],
  );

  const announceRuntimeNote = useCallback(
    (result: OrchestratorResult | null | undefined) => {
      const note = readOrchestratorRuntimeNote(result);
      if (!note) return;

      addChatMessage({
        id: uuidv4(),
        role: "system",
        content: note,
        timestamp: new Date().toISOString(),
        meta: { runtimeNote: true, fallbackUsed: !!result?.fallbackUsed },
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
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: validationMessage,
          timestamp: new Date().toISOString(),
          meta: { error: true },
        });
        return false;
      }

      const sanitizedRequestContent = preparedInput.sanitized;

      inFlightRef.current = true;
      safe(() => setIsAiLoading(true));
      safe(() => setError(null));

      const controller = new AbortController();
      abortControllerRef.current?.abort();
      abortControllerRef.current = controller;

      try {
        // ✅ FIX #1: Read from refs to avoid stale closures
        const currentMessages = messagesRef.current;
        const currentProjectFiles = projectFilesRef.current;
        const currentPendingPlan = pendingPlanRef.current;

        const historyAsLlm = buildSanitizedLlmHistory(currentMessages);

        // CALL 1: Planner (nur wenn nicht AutoFix / nicht forced / kein pendingPlan)
        if (!isAutoFix && !forceBuilder && !currentPendingPlan) {
          const advice = looksLikeAdviceRequest(sanitizedRequestContent);
          const explicitFileTask = looksLikeExplicitFileTask(sanitizedRequestContent);
          const shouldPlanner =
            advice ||
            (!forceBuilder && !explicitFileTask && looksAmbiguousBuilderRequest(sanitizedRequestContent));

          if (shouldPlanner) {
            const plannerMsgs = buildPlannerMessages(
              historyAsLlm,
              sanitizedRequestContent,
              currentProjectFiles,
              config.selectedChatProvider,
            );

            const planRes = await runOrchestratorWithHardTimeout(
              config.selectedChatProvider,
              config.selectedChatMode,
              "speed",
              plannerMsgs,
              controller.signal,
            );

            notifyKeyRotation(planRes);
            announceRuntimeNote(planRes);

            if (
              planRes?.ok &&
              typeof planRes.text === "string" &&
              planRes.text.trim().length > 0
            ) {
              const planText = planRes.text.trim();

              addChatMessage({
                id: uuidv4(),
                role: "assistant",
                content:
                  "🧩 **Kurz bevor ich Code anfasse:**\n\n" +
                  planText +
                  "\n\n🔒 **Hinweis zu Guarded-Pfaden:** Kritische/manual-only oder baseline/read-only Dateien setze ich nicht blind um; ich markiere sie vor dem Apply explizit.\n\n" +
                  '➡️ Antworte kurz auf die Fragen **oder** sag „weiter", dann starte ich den Build.',
                timestamp: new Date().toISOString(),
                meta: { planner: true },
              });

              const nextPlan: PendingPlan = {
                originalRequest: sanitizedRequestContent,
                planText,
                mode: advice ? "advice" : "build",
              };
              // Keep ref/state in sync immediately to avoid planner→builder races
              // when the follow-up user message lands before the next render commit.
              pendingPlanRef.current = nextPlan;
              safe(() => setPendingPlan(nextPlan));

              return true;
            }
          }
        }

        // CALL 2: Builder
        const llmMessages = buildBuilderMessages(
          historyAsLlm,
          sanitizedRequestContent,
          currentProjectFiles,
          config.selectedChatProvider,
        );

        let ai: OrchestratorResult | null = null;
        for (let attempt = 1; attempt <= BUILDER_RETRY_MAX_ATTEMPTS; attempt += 1) {
          ai = await runOrchestratorWithHardTimeout(
            config.selectedChatProvider,
            config.selectedChatMode,
            config.qualityMode,
            llmMessages,
            controller.signal,
          );

          notifyKeyRotation(ai);
          announceRuntimeNote(ai);

          if (ai?.ok) break;

          const errText = readOrchestratorErrorText(ai);
          const shouldRetry = shouldRetryBuilderAttempt({
            attempt,
            maxAttempts: BUILDER_RETRY_MAX_ATTEMPTS,
            errorText: errText,
          });
          if (!shouldRetry) break;

          const backoffMs = computeBuilderRetryDelayMs(attempt, errText);
          logger.warn(
            `[useChatAIFlow] Builder retry ${attempt}/${BUILDER_RETRY_MAX_ATTEMPTS - 1} in ${backoffMs}ms: ${errText.slice(0, 220)}`,
          );
          await sleepWithAbort(backoffMs, controller.signal);
        }

        if (!ai || !ai.ok) {
          throw new Error(getBuilderFailureMessage(ai));
        }

        // ✅ FIX #7: Type-safe extraction of raw data
        const rawForNormalizer = extractRawOrchestratorResult(ai as ExtendedOrchestratorResult);

        const normalizedResult = normalizeResultFiles(rawForNormalizer);
        const normalized = readBuilderFilesOrThrow(normalizedResult, ai.text ?? "");

        // Optional Agent (Validator)
        let finalFiles = normalized;
        let agentMeta: OrchestratorResult | null = null;
        let finalFileSource: PendingChange["finalFileSource"] = "builder";
        let validatorState: PendingChange["validatorState"] = config.agentEnabled ? "builder-fallback-empty" : "disabled";
        const addValidatorWarning = (validatorStateForMessage: PendingChange["validatorState"]) => {
          const content = validatorStateForMessage
            ? getValidatorFallbackWarning(validatorStateForMessage)
            : null;
          if (!content) return;

          addChatMessage({
            id: uuidv4(),
            role: "system",
            content,
            timestamp: new Date().toISOString(),
            meta: { validatorWarning: true },
          });
        };

        if (config.agentEnabled) {
          try {
            const validatorMsgs = buildValidatorMessages(
              sanitizedRequestContent,
              normalized.map((f) => ({ path: f.path, content: f.content })),
              currentProjectFiles,
              config.selectedAgentProvider ?? config.selectedChatProvider,
            );

            const agentRes = await runOrchestratorWithHardTimeout(
              config.selectedAgentProvider ?? config.selectedChatProvider,
              config.selectedAgentMode ?? config.selectedChatMode,
              "quality",
              validatorMsgs,
              controller.signal,
            );

            notifyKeyRotation(agentRes);

            if (agentRes?.ok) {
              const agentRaw = extractRawOrchestratorResult(agentRes as ExtendedOrchestratorResult);
              const normalizedAgent = normalizeResultFiles(agentRaw).files;
              if (normalizedAgent && normalizedAgent.length > 0) {
                finalFiles = normalizedAgent;
                agentMeta = agentRes;
                finalFileSource = "validator";
                validatorState = "validated";
              } else if (agentRes?.ok) {
                logger.warn("[useChatAIFlow] Validator returned no valid file array; keeping builder files.");
                validatorState = "builder-fallback-empty";
                addValidatorWarning(validatorState);
              }
            } else if (agentRes) {
              logger.warn("[useChatAIFlow] Validator returned non-ok result:", agentRes.error);
              validatorState = "builder-fallback-error";
              // Regression-Hinweis: "Validator-Prüfung war nicht erfolgreich"
              addValidatorWarning(validatorState);
            }
          } catch (e) {
            // ✅ FIX #8: Log agent errors and surface the fallback to the user
            logger.warn("[useChatAIFlow] Agent/Validator call failed:", e);
            validatorState = "builder-fallback-exception";
            // Regression-Hinweis: "Validator-Prüfung konnte nicht abgeschlossen werden"
            addValidatorWarning(validatorState);
          }
        }

        const baseProjectDigest = buildProjectStateDigest(currentProjectFiles);
        const mergeResult: ApplyFilesResult = applyFilesToProject(
          currentProjectFiles,
          finalFiles,
        );
        const changePreviews = buildChangePreviews({
          baseFiles: currentProjectFiles,
          finalFiles: mergeResult.files,
          created: mergeResult.created,
          updated: mergeResult.updated,
        });
        const sourceSummary = getSourceSummaryText(finalFileSource, config.agentEnabled);

        // Explain-Call
        let explainText = "";
        if (
          !isAutoFix &&
          mergeResult.created.length + mergeResult.updated.length > 0
        ) {
          try {
            const digest = buildChangeDigest(
              currentProjectFiles,
              mergeResult.files,
              mergeResult.created,
              mergeResult.updated,
            );
            const explainMsgs = buildExplainMessages(sanitizedRequestContent, digest);
            const explainRes = await runOrchestratorWithHardTimeout(
              config.selectedChatProvider,
              config.selectedChatMode,
              "speed",
              explainMsgs,
              controller.signal,
            );

            notifyKeyRotation(explainRes);
            if (explainRes?.ok && typeof explainRes.text === "string") {
              explainText = explainRes.text.trim();
            }
          } catch (e) {
            // ✅ FIX #8: Log explain errors instead of silently swallowing
            logger.warn("[useChatAIFlow] Explain call failed:", e);
            addChatMessage({
              id: uuidv4(),
              role: "system",
              content: "ℹ️ Konnte die Kurz-Erklärung für die Änderungen nicht erzeugen. Dateien können trotzdem übernommen werden.",
              timestamp: new Date().toISOString(),
              meta: { explainWarning: true },
            });
          }
        }

        const prefix = isAutoFix
          ? "🤖 **Auto-Fix Vorschlag:**"
          : "🤖 Die KI möchte folgende Änderungen vornehmen:";

        const summaryText =
          `${prefix}\n\n` +
          `${buildPreflightSummaryIntro()}\n\n` +
          `🧠 **Quelle der finalen Dateiliste:** ${sourceSummary}\n\n` +
          (explainText
            ? `🧾 **Kurz erklärt (warum/was):**\n${explainText}\n\n---\n\n`
            : "") +
          `📝 **Neue Dateien** (${mergeResult.created.length}):\n` +
          buildPathBulletList(mergeResult.created, 6) +
          `\n\n` +
          `📝 **Geänderte Dateien** (${mergeResult.updated.length}):\n` +
          buildPathBulletList(mergeResult.updated, 6) +
          (!isAutoFix
            ? `\n\n⏭ **Übersprungen** (${mergeResult.skipped.length}):\n` +
              buildPathBulletList(mergeResult.skipped, 3)
            : "") +
          (mergeResult.errors?.length
            ? `\n\n🚫 **Geblockt/Hinweise** (${mergeResult.errors.length}):\n` +
              mergeResult.errors.slice(0, 4).map((e) => `  • ${e}`).join("\n") +
              (mergeResult.errors.length > 4
                ? `\n  ... und ${mergeResult.errors.length - 4} weitere`
                : "")
            : "") +
          `\n\nMöchtest du diese Änderungen übernehmen?`;

        simulateStreaming(summaryText, () => {
          safe(() =>
            setPendingChange({
              files: mergeResult.files,
              proposedFiles: finalFiles,
              baseProjectDigest,
              summary: summaryText,
              created: mergeResult.created,
              updated: mergeResult.updated,
              skipped: mergeResult.skipped,
              errors: mergeResult.errors,
              aiResponse: ai!,
              agentResponse: agentMeta ?? undefined,
              changePreviews,
              finalFileSource,
              validatorState,
              sourceSummary,
            }),
          );
          safe(() => setShowConfirmModal(true));
        });

        return true;
      } catch (e: unknown) {
        if (!isMountedRef.current) return false;

        const error = e instanceof Error ? e : new Error(String(e));
        if (error.name === "AbortError" || /abgebrochen/i.test(error.message)) {
          return false;
        }

        const msg = `⚠️ ${error.message || "Es ist ein Fehler im Builder-Flow aufgetreten."}`;
        safe(() => setError(msg));

        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: msg,
          timestamp: new Date().toISOString(),
          meta: { error: true },
        });

        return false;
      } finally {
        safe(() => setIsAiLoading(false));
        inFlightRef.current = false;
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }

        // Drain queued AutoFix after this call completes
        setTimeout(() => {
          if (isMountedRef.current) drainAutoFixQueue();
        }, 0);
      }
    },
    [
      addChatMessage,
      config,
      drainAutoFixQueue,
      notifyKeyRotation,
      announceRuntimeNote,
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
        addChatMessage({
          id: uuidv4(),
          role: "system",
          content:
            "ℹ️ Projektzustand hat sich seit dem KI-Vorschlag geändert. Änderungen wurden auf den aktuellen Stand neu angewendet.",
          timestamp: new Date().toISOString(),
          meta: { stateDrift: true },
        });
      }

      const confirmationText = buildChangeConfirmationText({
        ...pendingChange,
        files: applyResult.files,
        created: applyResult.created,
        updated: applyResult.updated,
        skipped: applyResult.skipped,
        errors: applyResult.errors ?? pendingChange.errors,
      });

      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: confirmationText,
        timestamp: new Date().toISOString(),
        meta: { provider: pendingChange.aiResponse?.provider || "system" },
      });

      requestAnimationFrame(() => hardScrollToBottom(true));
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      Alert.alert(
        "Fehler beim Anwenden",
        error.message || "Änderungen konnten nicht angewendet werden.",
      );
      addChatMessage({
        id: uuidv4(),
        role: "system",
        content: `⚠️ Fehler beim Anwenden der Änderungen: ${error.message || "Unbekannt"}`,
        timestamp: new Date().toISOString(),
        meta: { error: true },
      });
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
    addChatMessage({
      id: uuidv4(),
      role: "system",
      content: "❌ Änderungen wurden abgelehnt. Keine Dateien wurden geändert.",
      timestamp: new Date().toISOString(),
    });
    safe(() => setShowConfirmModal(false));
    safe(() => setPendingChange(null));
  }, [addChatMessage, safe, setShowConfirmModal]);

  const handleSendWithMeta = useCallback(
    async (
      rawInput: string,
      aiInput: string = rawInput,
    ): Promise<boolean> => {
      const userContent = rawInput.trim();
      const aiContent = aiInput.trim();
      const candidateInput = aiContent || userContent;

      // Regression-Hinweis für Attachment-only-Pfade:
      // if (!userContent && !aiContent) return false;
      if (!userContent && !candidateInput) return false;

      // Meta-/lokale Kommandos müssen auf unverändertem User-Input laufen.
      const metaResult = userContent
        ? handleMetaCommand(userContent, projectFilesRef.current)
        : { handled: false };
      if (metaResult.handled && metaResult.message) {
        addChatMessage({
          id: uuidv4(),
          role: "user",
          content: userContent,
          timestamp: new Date().toISOString(),
          meta: { localOnly: true, metaCommand: true },
        });
        addChatMessage(metaResult.message);
        return true;
      }

      const validation = prepareValidatedChatInput(candidateInput);
      if (!validation.valid) {
        const validationMessage =
          validation.error === "Nachricht ist zu lang"
            ? "⚠️ Deine Nachricht ist zu lang. Bitte kürze den Prompt oder teile ihn in kleinere Schritte auf."
            : `⚠️ ${validation.error || "Nachricht konnte nicht verarbeitet werden."}`;

        safe(() => setError(validationMessage));
        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: validationMessage,
          timestamp: new Date().toISOString(),
          meta: { error: true },
        });
        return false;
      }

      const sanitizedAiContent = validation.sanitized;
      const sanitizedUserContent = userContent
        ? prepareValidatedChatInput(userContent).sanitized || userContent
        : sanitizedAiContent;

      if (!sanitizedAiContent) {
        safe(() => setError("⚠️ Nachricht ist leer."));
        return false;
      }

      addChatMessage({
        id: uuidv4(),
        role: "user",
        // Regression-Hinweis: content: userContent || aiContent,
        content: sanitizedUserContent || sanitizedAiContent,
        timestamp: new Date().toISOString(),
      });

      if (validation.hadXSS) {
        addChatMessage({
          id: uuidv4(),
          role: "system",
          content: "ℹ️ Eingabe enthielt auffällige Script-/XSS-Muster und wurde vor dem AI-Flow bereinigt. Der Flow läuft mit der sanitizten Eingabe weiter.",
          timestamp: new Date().toISOString(),
          meta: { validatorWarning: true },
        });
      }

      // ✅ FIX #1: Use ref for fresh pendingPlan
      const currentPlan = pendingPlanRef.current;
      if (currentPlan) {
        const lower = sanitizedUserContent.trim().toLowerCase();
        const wantsProceed =
          lower === "weiter" ||
          lower === "mach weiter" ||
          lower === "ok" ||
          lower === "ja" ||
          lower === "go";

        if (currentPlan.mode === "advice" && !wantsProceed) {
          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content:
              'Alles klar. Wenn du willst, kann ich das direkt umsetzen – sag einfach **„weiter"** oder nenn die Features.',
            timestamp: new Date().toISOString(),
          });
          return true;
        }

        const combined =
          currentPlan.originalRequest +
          "\n\n---\nPlaner-Ausgabe:\n" +
          currentPlan.planText +
          "\n\n---\nNutzer-Antwort/Details:\n" +
          // Regression-Hinweis: Attachment-only Follow-up muss semantisch aiContent/userContent weitertragen.
          // (wantsProceed ? "(User sagt: weiter)" : aiContent || userContent);
          (wantsProceed ? "(User sagt: weiter)" : sanitizedAiContent);

        pendingPlanRef.current = null;
        safe(() => setPendingPlan(null));
        await processAIRequest(combined, false, true);
        return true;
      }

      // Regression-Hinweis: const ok = await processAIRequest(aiContent || userContent, false, false);
      const ok = await processAIRequest(sanitizedAiContent, false, false);
      return ok;
    },
    [addChatMessage, processAIRequest, safe, setError],
  );

  const resetTransientState = useCallback(() => {
    cleanupStreamingTimer();
    streamingRunIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    inFlightRef.current = false;
    queuedAutoFixRef.current = [];
    pendingPlanRef.current = null;
    pendingChangeRef.current = null;

    safe(() => setIsStreaming(false));
    safe(() => setStreamingMessage(""));
    safe(() => setIsAiLoading(false));
    safe(() => setShowConfirmModal(false));
    safe(() => setPendingPlan(null));
    safe(() => setPendingChange(null));
  }, [
    cleanupStreamingTimer,
    safe,
    setIsAiLoading,
    setIsStreaming,
    setShowConfirmModal,
    setStreamingMessage,
  ]);

  const handleScreenBlurCleanup = useCallback(() => {
    const hadActiveRequest =
      inFlightRef.current || abortControllerRef.current !== null;
    const hadQueuedAutoFix = queuedAutoFixRef.current.length > 0;

    if (!hadActiveRequest && !hadQueuedAutoFix) return;

    const preservedPendingState =
      pendingPlanRef.current !== null || pendingChangeRef.current !== null;

    cleanupStreamingTimer();
    streamingRunIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    inFlightRef.current = false;
    queuedAutoFixRef.current = [];

    safe(() => setIsStreaming(false));
    safe(() => setStreamingMessage(""));
    safe(() => setIsAiLoading(false));

    addChatMessage({
      id: uuidv4(),
      role: "system",
      content: preservedPendingState
        ? "ℹ️ Laufender KI-Vorgang wurde beim Verlassen des Chat-Screens abgebrochen. Vorliegende Plan-/Änderungsstände bleiben erhalten."
        : "ℹ️ Laufender KI-Vorgang wurde beim Verlassen des Chat-Screens abgebrochen.",
      timestamp: new Date().toISOString(),
      meta: {
        requestAbortedOnBlur: true,
        preservedPendingState,
      },
    });
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
