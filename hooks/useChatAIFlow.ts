// hooks/useChatAIFlow.ts
// REFACTORED: types + helpers → chatAIFlowTypes.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";
import { v4 as uuidv4 } from "uuid";
import type { AIConfig } from "../contexts/AIContext";
import type { OrchestratorResult } from "../lib/orchestrator";
import type { ApplyFilesResult } from "../lib/fileWriter";
import type { ChatMessage } from "../shared/types/chat";
import type { ProjectFile } from "../shared/types/project";


import { extractRawOrchestratorResult, MAX_AUTOFIX_QUEUE } from "./chatAIFlowTypes";
import type { ExtendedOrchestratorResult, UseChatAIFlowArgs, PendingChange, PendingPlan } from "./chatAIFlowTypes";
import { buildChangeConfirmationText } from "./chatChangeSummary";

import { runOrchestrator } from "../lib/orchestrator";
import { normalizeAiResponse } from "../lib/normalizer";
import { logger } from "../lib/logger";
import { applyFilesToProject } from "../lib/fileWriter";
import { buildBuilderMessages, buildPlannerMessages, buildValidatorMessages } from "../lib/promptEngine";
import { looksLikeExplicitFileTask, looksLikeAdviceRequest, looksAmbiguousBuilderRequest, buildChangeDigest, buildExplainMessages } from "../utils/chatHeuristics";
import { handleMetaCommand } from "../utils/metaCommands";

export type { PendingChange, PendingPlan } from "./chatAIFlowTypes";

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

  // ✅ FIX #1: Keep fresh references to avoid stale closures in AutoFix queue
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const projectFilesRef = useRef(projectFiles);
  projectFilesRef.current = projectFiles;

  const pendingPlanRef = useRef(pendingPlan);
  pendingPlanRef.current = pendingPlan;

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

  // ✅ FIX #2: Cleanup streaming timer on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      cleanupStreamingTimer();
      inFlightRef.current = false;
    };
  }, [cleanupStreamingTimer]);

  const simulateStreaming = useCallback(
    (fullText: string, onComplete: () => void) => {
      cleanupStreamingTimer();

      safe(() => setIsStreaming(true));
      safe(() => setStreamingMessage(""));

      let currentIndex = 0;
      const chunkSize = 12;
      const delay = 18;

      const tick = () => {
        if (!isMountedRef.current) {
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

  const processAIRequest = useCallback(
    async (userContent: string, isAutoFix = false, forceBuilder = false) => {
      if (inFlightRef.current) return false;

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

        const historyAsLlm = currentMessages
          .map((m) => ({ role: m.role, content: m.content }))
          .filter((m) => String(m.content ?? "").trim().length > 0);

        // CALL 1: Planner (nur wenn nicht AutoFix / nicht forced / kein pendingPlan)
        if (!isAutoFix && !forceBuilder && !currentPendingPlan) {
          const advice = looksLikeAdviceRequest(userContent);
          const shouldPlanner =
            advice ||
            (looksAmbiguousBuilderRequest(userContent) &&
              !looksLikeExplicitFileTask(userContent));

          if (shouldPlanner) {
            const plannerMsgs = buildPlannerMessages(
              historyAsLlm,
              userContent,
              currentProjectFiles,
            );

            const planRes = await runOrchestrator(
              config.selectedChatProvider,
              config.selectedChatMode,
              "speed",
              plannerMsgs,
              controller.signal,
            );

            notifyKeyRotation(planRes);

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
                  '\n\n➡️ Antworte kurz auf die Fragen **oder** sag „weiter", dann starte ich den Build.',
                timestamp: new Date().toISOString(),
                meta: { planner: true },
              });

              safe(() =>
                setPendingPlan({
                  originalRequest: userContent,
                  planText,
                  mode: advice ? "advice" : "build",
                }),
              );

              return true;
            }
          }
        }

        // CALL 2: Builder
        const llmMessages = buildBuilderMessages(
          historyAsLlm,
          userContent,
          currentProjectFiles,
        );

        let ai: OrchestratorResult | null = await runOrchestrator(
          config.selectedChatProvider,
          config.selectedChatMode,
          config.qualityMode,
          llmMessages,
          controller.signal,
        );

        notifyKeyRotation(ai);

        if (!ai?.ok) {
          const errText = String(ai?.error ?? "");
          const shouldRetry =
            /\b429\b|\brate\s*limit\b|\b503\b|overloaded|timeout|timed\s*out|ECONNRESET|network/i.test(
              errText,
            );
          if (shouldRetry) {
            ai = await runOrchestrator(
              config.selectedChatProvider,
              config.selectedChatMode,
              config.qualityMode,
              llmMessages,
              controller.signal,
            );

            notifyKeyRotation(ai);
          }
        }

        if (!ai || !ai.ok) {
          const details =
            ai?.error ||
            ai?.errors?.join?.("\n") ||
            "Kein ok=true (unbekannter Fehler).";
          throw new Error(`KI-Request fehlgeschlagen: ${details}`);
        }

        // ✅ FIX #7: Type-safe extraction of raw data
        const rawForNormalizer = extractRawOrchestratorResult(ai as ExtendedOrchestratorResult);

        const normalized = normalizeAiResponse(rawForNormalizer);
        if (!normalized) {
          const preview =
            typeof ai.text === "string"
              ? ai.text.slice(0, 600).replace(/\s+/g, " ")
              : "";
          throw new Error(
            "Normalizer/Validator konnte die Dateien nicht verarbeiten." +
              (preview ? `\n\nOutput-Preview: ${preview}` : ""),
          );
        }

        // Optional Agent (Validator)
        let finalFiles = normalized;
        let agentMeta: OrchestratorResult | null = null;

        if (config.agentEnabled) {
          try {
            const validatorMsgs = buildValidatorMessages(
              userContent,
              normalized.map((f: any) => ({ path: f.path, content: f.content })),
              currentProjectFiles,
            );

            const agentRes = await runOrchestrator(
              config.selectedAgentProvider ?? config.selectedChatProvider,
              config.selectedAgentMode ?? config.selectedChatMode,
              "quality",
              validatorMsgs,
              controller.signal,
            );

            notifyKeyRotation(agentRes);

            if (agentRes?.ok) {
              const agentRaw = extractRawOrchestratorResult(agentRes as ExtendedOrchestratorResult);
              const normalizedAgent = normalizeAiResponse(agentRaw);
              if (normalizedAgent && normalizedAgent.length > 0) {
                finalFiles = normalizedAgent;
                agentMeta = agentRes;
              }
            }
          } catch (e) {
            // ✅ FIX #8: Log agent errors instead of silently swallowing
            logger.warn("[useChatAIFlow] Agent/Validator call failed:", e);
          }
        }

        const mergeResult: ApplyFilesResult = applyFilesToProject(
          currentProjectFiles,
          finalFiles,
        );

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
            const explainMsgs = buildExplainMessages(userContent, digest);
            const explainRes = await runOrchestrator(
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
          }
        }

        const prefix = isAutoFix
          ? "🤖 **Auto-Fix Vorschlag:**"
          : "🤖 Die KI möchte folgende Änderungen vornehmen:";

        const summaryText =
          `${prefix}\n\n` +
          (explainText
            ? `🧾 **Kurz erklärt (warum/was):**\n${explainText}\n\n---\n\n`
            : "") +
          `📝 **Neue Dateien** (${mergeResult.created.length}):\n` +
          (mergeResult.created.length
            ? mergeResult.created
                .slice(0, 6)
                .map((f: string) => `  • `)
                .join("\n") +
              (mergeResult.created.length > 6
                ? `\n  ... und ${mergeResult.created.length - 6} weitere`
                : "")
            : "  (keine)") +
          `\n\n` +
          `📝 **Geänderte Dateien** (${mergeResult.updated.length}):\n` +
          (mergeResult.updated.length
            ? mergeResult.updated
                .slice(0, 6)
                .map((f: string) => `  • `)
                .join("\n") +
              (mergeResult.updated.length > 6
                ? `\n  ... und ${mergeResult.updated.length - 6} weitere`
                : "")
            : "  (keine)") +
          (!isAutoFix
            ? `\n\n⏭ **Übersprungen** (${mergeResult.skipped.length}):\n` +
              (mergeResult.skipped.length
                ? mergeResult.skipped
                    .slice(0, 3)
                    .map((f: string) => `  • `)
                    .join("\n") +
                  (mergeResult.skipped.length > 3
                    ? `\n  ... und ${mergeResult.skipped.length - 3} weitere`
                    : "")
                : "  (keine)")
            : "") +
          `\n\nMöchtest du diese Änderungen übernehmen?`;

        simulateStreaming(summaryText, () => {
          safe(() =>
            setPendingChange({
              files: mergeResult.files,
              summary: summaryText,
              created: mergeResult.created,
              updated: mergeResult.updated,
              skipped: mergeResult.skipped,
              aiResponse: ai!,
              agentResponse: agentMeta ?? undefined,
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
      safe,
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
      await updateProjectFiles(pendingChange.files);

      const confirmationText = buildChangeConfirmationText(pendingChange);

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
    async (rawInput: string, selectedFileName?: string): Promise<boolean> => {
      const userContent =
        rawInput.trim() ||
        (selectedFileName ? `Datei gesendet: ${selectedFileName}` : "");

      if (!userContent.trim()) return false;

      addChatMessage({
        id: uuidv4(),
        role: "user",
        content: userContent,
        timestamp: new Date().toISOString(),
      });

      // ✅ FIX #1: Use ref for fresh projectFiles
      const metaResult = handleMetaCommand(rawInput.trim(), projectFilesRef.current);
      if (metaResult.handled && metaResult.message) {
        addChatMessage(metaResult.message);
        return true;
      }

      // ✅ FIX #1: Use ref for fresh pendingPlan
      const currentPlan = pendingPlanRef.current;
      if (currentPlan) {
        const lower = userContent.trim().toLowerCase();
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
          (wantsProceed ? "(User sagt: weiter)" : userContent);

        safe(() => setPendingPlan(null));
        await processAIRequest(combined, false, true);
        return true;
      }

      const ok = await processAIRequest(userContent, false, false);
      return ok;
    },
    [addChatMessage, processAIRequest, safe],
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
    }),
    [
      applyChanges,
      handleSendWithMeta,
      pendingChange,
      pendingPlan,
      rejectChanges,
      setAtBottom,
    ],
  );

}

