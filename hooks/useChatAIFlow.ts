import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";
import { v4 as uuidv4 } from "uuid";

import { ChatMessage, ProjectFile } from "../contexts/types";
import type { AllAIProviders, QualityMode } from "../contexts/AIContext";
import { runOrchestrator } from "../lib/orchestrator";
import type { OrchestratorResult } from "../lib/orchestrator";
import { normalizeAiResponse } from "../lib/normalizer";
import { applyFilesToProject } from "../lib/fileWriter";
import {
  buildBuilderMessages,
  buildPlannerMessages,
  buildValidatorMessages,
} from "../lib/promptEngine";
import {
  looksLikeExplicitFileTask,
  looksLikeAdviceRequest,
  looksAmbiguousBuilderRequest,
  buildChangeDigest,
  buildExplainMessages,
} from "../utils/chatHeuristics";
import { handleMetaCommand } from "../utils/metaCommands";

export type PendingChange = {
  files: ProjectFile[];
  summary: string;
  created: string[];
  updated: string[];
  skipped: string[];
  aiResponse: OrchestratorResult;
  agentResponse?: OrchestratorResult;
};

export type PendingPlan = {
  originalRequest: string;
  planText: string;
  mode: "advice" | "build";
};

type ConfigLike = {
  selectedChatProvider: any;
  selectedChatMode: any;
  qualityMode: any;
  agentEnabled?: boolean;
  selectedAgentProvider?: any;
  selectedAgentMode?: any;
};

type AutoFixRequestLike = { message: string } | null;

type UseChatAIFlowArgs = {
  config: ConfigLike;
  messages: ChatMessage[];
  projectFiles: ProjectFile[];
  addChatMessage: (m: ChatMessage) => void;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
  autoFixRequest: AutoFixRequestLike;
  clearAutoFixRequest: () => void;

  hardScrollToBottom: (animated: boolean) => void;

  setIsStreaming: (v: boolean) => void;
  setStreamingMessage: React.Dispatch<React.SetStateAction<string>>;
  setIsAiLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setShowConfirmModal: (v: boolean) => void;
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

  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const processAIRequestRef = useRef<((m: string, isAutoFix?: boolean, forceBuilder?: boolean) => Promise<boolean>) | null>(null);

  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ AutoFix: keine Busy-Wait Schleife mehr -> FIFO Queue + Drain
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
        if (!isMountedRef.current) return;

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
          return true;
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

    // Request starten (ohne Planner)
    const runner = processAIRequestRef.current;
    if (runner) void runner(msg, true, true);
  }, [addChatMessage]);

  // AutoFix kommt rein -> in FIFO Queue packen, clearen, drain versuchen
  useEffect(() => {
    const msg = autoFixRequest?.message;
    if (!msg) return;

    queuedAutoFixRef.current.push(msg);
    clearAutoFixRequest();
    drainAutoFixQueue();
  }, [autoFixRequest, clearAutoFixRequest, drainAutoFixQueue]);



const notifyKeyRotation = useCallback(
  (res: OrchestratorResult | unknown) => {
    const r: any = res as any;
    const count = Number(r?.keysRotated ?? 0);
    if (!count || count <= 0) return;

    const provider = String(r?.provider ?? "unbekannt");
    const msg = `🔑 Key rotiert (${count}x) wegen 429/Rate-Limit • Provider: ${provider}`;

    // Android-first: Toast + zusätzlich Log-Row im Chat (system)
    try {
      if (Platform.OS === "android") {
        ToastAndroid.show(msg, ToastAndroid.LONG);
      }
    } catch {}

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
      // falls ein alter Request hängt, abbrechen
      abortControllerRef.current?.abort();
      abortControllerRef.current = controller;

      try {
        const historyAsLlm = messages
          .map((m) => ({ role: m.role, content: m.content }))
          .filter((m) => String(m.content ?? "").trim().length > 0);

        // ✅ CALL 1: Planner (nur wenn nicht AutoFix / nicht forced / kein pendingPlan)
        if (!isAutoFix && !forceBuilder && !pendingPlan) {
          const advice = looksLikeAdviceRequest(userContent);
          const shouldPlanner =
            advice ||
            (looksAmbiguousBuilderRequest(userContent) &&
              !looksLikeExplicitFileTask(userContent));

          if (shouldPlanner) {
            const plannerMsgs = buildPlannerMessages(
              historyAsLlm,
              userContent,
              projectFiles,
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

        // ✅ CALL 2: Builder
        const llmMessages = buildBuilderMessages(
          historyAsLlm,
          userContent,
          projectFiles,
        );

        let ai = await runOrchestrator(
          config.selectedChatProvider,
          config.selectedChatMode,
          config.qualityMode,
          llmMessages,
          controller.signal,
        );

        // Hinweis: Auto-Key-Rotation (429) sichtbar machen
        notifyKeyRotation(ai);

        if (!ai?.ok) {
          const errText = String((ai as any)?.error ?? "");
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
            (ai as any)?.error ||
            (ai as any)?.errors?.join?.("\n") ||
            "Kein ok=true (unbekannter Fehler).";
          throw new Error(`KI-Request fehlgeschlagen: ${details}`);
        }

        const rawForNormalizer =
          (ai as any).files && Array.isArray((ai as any).files)
            ? (ai as any).files
            : (ai as any).text
              ? (ai as any).text
              : (ai as any).raw;

        const normalized = normalizeAiResponse(rawForNormalizer);
        if (!normalized) {
          const preview =
            typeof (ai as any).text === "string"
              ? String((ai as any).text)
                  .slice(0, 600)
                  .replace(/\s+/g, " ")
              : "";
          throw new Error(
            "Normalizer/Validator konnte die Dateien nicht verarbeiten." +
              (preview ? `\n\nOutput-Preview: ${preview}` : ""),
          );
        }

        // ✅ Optional Agent (Validator)
        let finalFiles = normalized;
        let agentMeta: any = null;

        if ((config as any)?.agentEnabled) {
          try {
            const validatorMsgs = buildValidatorMessages(
              userContent,
              normalized.map((f: any) => ({
                path: f.path,
                content: f.content,
              })),
              projectFiles,
            );

            const agentRes = await runOrchestrator(
              (config as any)?.selectedAgentProvider ??
                config.selectedChatProvider,
              (config as any)?.selectedAgentMode ?? config.selectedChatMode,
              "quality",
              validatorMsgs,
              controller.signal,
            );

            notifyKeyRotation(agentRes);

            if (agentRes && agentRes.ok) {
              const agentRaw =
                (agentRes as any).files &&
                Array.isArray((agentRes as any).files)
                  ? (agentRes as any).files
                  : agentRes.text
                    ? agentRes.text
                    : (agentRes as any).raw;

              const normalizedAgent = normalizeAiResponse(agentRaw);
              if (normalizedAgent && normalizedAgent.length > 0) {
                finalFiles = normalizedAgent;
                agentMeta = agentRes;
              }
            }
          } catch {}
        }

        const mergeResult = applyFilesToProject(projectFiles, finalFiles);

        // ✅ Explain-Call
        let explainText = "";
        if (
          !isAutoFix &&
          mergeResult.created.length + mergeResult.updated.length > 0
        ) {
          try {
            const digest = buildChangeDigest(
              projectFiles,
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
          } catch {}
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
                .map((f) => `  • ${f}`)
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
                .map((f) => `  • ${f}`)
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
                    .map((f) => `  • ${f}`)
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
              aiResponse: ai,
              agentResponse: agentMeta ?? undefined,
            }),
          );
          safe(() => setShowConfirmModal(true));
        });

        return true;
      } catch (e: any) {
        if (!isMountedRef.current) return false;
        if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("abgebrochen")) {
          return false;
        }
        const msg = `⚠️ ${e?.message || "Es ist ein Fehler im Builder-Flow aufgetreten."}`;
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

        // ✅ Wenn AutoFix queued ist: nach dem Call abarbeiten
        setTimeout(() => {
          if (isMountedRef.current) drainAutoFixQueue();
        }, 0);
      }
    },
    [
      addChatMessage,
      config,
      drainAutoFixQueue,
      messages,
      pendingPlan,
      projectFiles,
      safe,
      setError,
      setIsAiLoading,
      setShowConfirmModal,
      simulateStreaming,
    ],
  );

  // keep latest runner for AutoFix queue
  processAIRequestRef.current = processAIRequest;

  const applyChanges = useCallback(async () => {
    if (!pendingChange) return;

    safe(() => setShowConfirmModal(false));

    try {
      await updateProjectFiles(pendingChange.files);

      const timing = pendingChange.aiResponse?.timing?.durationMs
        ? ` (${(pendingChange.aiResponse.timing.durationMs / 1000).toFixed(1)}s)`
        : "";

      const { created, updated, skipped } = pendingChange;

      const summaryText =
        `🤖 Provider: ${pendingChange.aiResponse?.provider || "unbekannt"}${
          pendingChange.aiResponse?.keysRotated
            ? ` (${pendingChange.aiResponse.keysRotated}x Key-Rotation)`
            : ""
        }\n` +
        `🆕 Neue Dateien: ${created.length}\n` +
        `✏️ Geänderte Dateien: ${updated.length}\n` +
        `⏭️ Übersprungen: ${skipped.length}`;

      const lines: string[] = [];
      if (created.length) {
        lines.push("🆕 Neue Dateien:");
        created.forEach((p) => lines.push(`  • ${p}`));
      }
      if (updated.length) {
        lines.push("✏️ Geänderte Dateien:");
        updated.forEach((p) => lines.push(`  • ${p}`));
      }
      if (skipped.length) {
        lines.push("⏭️ Übersprungene Dateien:");
        skipped.forEach((p) => lines.push(`  • ${p}`));
      }

      const filesBlock = lines.length
        ? `\n\n📂 Details:\n${lines.join("\n")}`
        : "";
      const confirmationText = `✅ Änderungen erfolgreich angewendet${timing}\n\n${summaryText}${filesBlock}`;

      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content: confirmationText,
        timestamp: new Date().toISOString(),
        meta: { provider: pendingChange.aiResponse?.provider || "system" },
      });

      requestAnimationFrame(() => hardScrollToBottom(true));
    } catch (e: any) {
      Alert.alert(
        "Fehler beim Anwenden",
        e?.message || "Änderungen konnten nicht angewendet werden.",
      );
      addChatMessage({
        id: uuidv4(),
        role: "system",
        content: `⚠️ Fehler beim Anwenden der Änderungen: ${e?.message || "Unbekannt"}`,
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

      const metaResult = handleMetaCommand(rawInput.trim(), projectFiles);
      if (metaResult.handled && metaResult.message) {
        addChatMessage(metaResult.message);
        return true;
      }

      if (pendingPlan) {
        const lower = userContent.trim().toLowerCase();
        const wantsProceed =
          lower === "weiter" ||
          lower === "mach weiter" ||
          lower === "ok" ||
          lower === "ja" ||
          lower === "go";

        if (pendingPlan.mode === "advice" && !wantsProceed) {
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
          pendingPlan.originalRequest +
          "\n\n---\nPlaner-Ausgabe:\n" +
          pendingPlan.planText +
          "\n\n---\nNutzer-Antwort/Details:\n" +
          (wantsProceed ? "(User sagt: weiter)" : userContent);

        safe(() => setPendingPlan(null));
        await processAIRequest(combined, false, true);
        return true;
      }

      const ok = await processAIRequest(userContent, false, false);
      return ok;
    },
    [addChatMessage, pendingPlan, processAIRequest, projectFiles, safe],
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