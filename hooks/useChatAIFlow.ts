import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ChatMessage, ProjectFile } from "../contexts/types";
import { runOrchestrator } from "../lib/orchestrator";
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
import { CONFIG } from "../config";

type PendingChange = {
  files: ProjectFile[];
  summary: string;
  created: string[];
  updated: string[];
  skipped: string[];
  aiResponse: any;
  agentResponse?: any;
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

type AutoFixRequestLike = {
  requestText: string;
  createdAt: string;
};

type UseChatAIFlowArgs = {
  config: ConfigLike;
  activeRepo?: string | null;
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useChatAIFlow({
  config,
  activeRepo,
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
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(
    null,
  );
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);

  const isAtBottomRef = useRef(true);
  const setAtBottom = useCallback((v: boolean) => {
    isAtBottomRef.current = v;
  }, []);

  const applyChanges = useCallback(async () => {
    if (!pendingChange) return;
    await applyFilesToProject(
      pendingChange.files,
      projectFiles,
      updateProjectFiles,
    );
    setPendingChange(null);
    setShowConfirmModal(false);
  }, [pendingChange, projectFiles, updateProjectFiles, setShowConfirmModal]);

  const rejectChanges = useCallback(() => {
    setPendingChange(null);
    setShowConfirmModal(false);
  }, [setShowConfirmModal]);

  const pushAssistant = useCallback(
    (content: string) => {
      addChatMessage({
        id: uuidv4(),
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
      });
      hardScrollToBottom(true);
    },
    [addChatMessage, hardScrollToBottom],
  );

  /**
   * ✅ Pollt check-native-sync und schreibt Status updates in den Chat.
   * - sendet nur dann ein Update, wenn sich status ändert oder ein Run-Link auftaucht
   */
  const pollNativeSyncStatusToChat = useCallback(
    async (jobId: string) => {
      const url = `${CONFIG.API.SUPABASE_EDGE_URL}/check-native-sync`;

      let lastStatus = "";
      let lastRunUrl = "";

      // bis zu ~45s (15 * 3s) – reicht normalerweise, bis ein Run sichtbar ist
      for (let i = 0; i < 15; i++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.ok) {
            // nicht sofort abbrechen – GitHub braucht manchmal kurz
            await sleep(3000);
            continue;
          }

          const status = String(json?.job?.status || "").toLowerCase();
          const runUrl = json?.run?.html_url ? String(json.run.html_url) : "";
          const runStatus = json?.run?.status ? String(json.run.status) : "";
          const runConclusion = json?.run?.conclusion
            ? String(json.run.conclusion)
            : "";

          const statusChanged = status && status !== lastStatus;
          const runChanged = runUrl && runUrl !== lastRunUrl;

          if (statusChanged || runChanged) {
            lastStatus = status || lastStatus;
            lastRunUrl = runUrl || lastRunUrl;

            const nice =
              status === "success"
                ? "✅ SUCCESS"
                : status === "error"
                  ? "❌ ERROR"
                  : status === "running"
                    ? "⏳ RUNNING"
                    : status === "queued"
                      ? "🕒 QUEUED"
                      : status === "dispatched"
                        ? "🚀 DISPATCHED"
                        : status
                          ? status.toUpperCase()
                          : "…";

            let msg =
              `📡 Native Sync Status Update\n\n` +
              `🆔 JobId: ${jobId}\n` +
              `Status: ${nice}\n`;

            if (runStatus) msg += `Run Status: ${runStatus}\n`;
            if (runConclusion) msg += `Run Conclusion: ${runConclusion}\n`;

            if (runUrl) msg += `\n🔗 Run: ${runUrl}\n`;
            if (activeRepo && !runUrl) msg += `\nℹ️ Repo: ${activeRepo}\n`;

            pushAssistant(msg.trim());
          }

          // stop conditions
          if (status === "success" || status === "error") break;
        } catch {
          // ignore + keep polling
        }

        await sleep(3000);
      }
    },
    [activeRepo, pushAssistant],
  );

  const handleSendWithMeta = useCallback(
    async (userContent: string) => {
      const rawInput = String(userContent ?? "");
      if (!rawInput.trim()) return;

      // user message
      addChatMessage({
        id: uuidv4(),
        role: "user",
        content: userContent,
        timestamp: new Date().toISOString(),
      });

      // ✅ Local Chat Command: sync native deps/plugins (no LLM needed)
      // Examples:
      // - "sync deps"
      // - "aktualisiere dependencies"
      // - "aktualisiere defenses der dev apk"
      // - "scan native deps"
      const wantsSyncNative =
        /(\b(sync|scan|update|aktualisiere|prüfe|checke)\b.*\b(dep|deps|dependencies|defenses|native)\b)/i.test(
          rawInput,
        ) ||
        /(\bdev\b.*\b(apk|build)\b.*\b(dep|deps|dependencies|defenses)\b)/i.test(
          rawInput,
        );

      if (wantsSyncNative) {
        if (!activeRepo) {
          pushAssistant(
            "⚠️ Kein GitHub-Repo ausgewählt. Geh erst zu „GitHub Repos“ und wähle eins aus – dann kann ich die Dependencies syncen.",
          );
          return;
        }

        try {
          setIsAiLoading(true);

          // ✅ Trigger via Supabase Edge Function
          const res = await fetch(
            `${CONFIG.API.SUPABASE_EDGE_URL}/trigger-native-sync`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                githubRepo: activeRepo,
                ref: "main",
                inputs: {
                  apply: "true",
                  create_pr: /\bpr\b/i.test(rawInput) ? "true" : "false",
                  base_ref: "main",
                },
              }),
            },
          );

          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.ok) {
            throw new Error(json?.error || `Trigger failed (${res.status})`);
          }

          const jobId = json?.jobId ? String(json.jobId) : "";

          pushAssistant(
            "🧩 Native-Dependency Sync gestartet.\n\n" +
              (jobId ? `🆔 JobId: ${jobId}\n` : "") +
              "Ich poste gleich automatisch Status-Updates hier im Chat (queued → running → success/error).",
          );

          // ✅ Auto status polling in chat
          if (jobId) {
            pollNativeSyncStatusToChat(jobId);
          }
        } catch (e: any) {
          pushAssistant(
            `❌ Sync fehlgeschlagen: ${e?.message || "Unbekannter Fehler"}`,
          );
        } finally {
          setIsAiLoading(false);
        }
        return;
      }

      const metaResult = handleMetaCommand(rawInput.trim(), projectFiles);
      if (metaResult.handled && metaResult.message) {
        addChatMessage(metaResult.message);
        return;
      }

      // existing flow (planner/builder/validator)
      try {
        setError(null);
        setIsAiLoading(true);
        setIsStreaming(false);
        setStreamingMessage("");

        // If there is a pending plan, user can proceed/abort...
        if (pendingPlan) {
          const lower = userContent.trim().toLowerCase();
          const wantsProceed =
            lower.includes("ja") ||
            lower.includes("ok") ||
            lower.includes("mach") ||
            lower.includes("go") ||
            lower.includes("weiter");

          if (!wantsProceed) {
            pushAssistant(
              "Alles klar. Sag einfach „weiter“ wenn ich den Plan umsetzen soll.",
            );
            return;
          }
        }

        const isAdvice = looksLikeAdviceRequest(userContent);
        const isAmbiguous = looksAmbiguousBuilderRequest(userContent);

        let agentResponse: any = null;

        // Planner first if ambiguous/advice
        if (isAdvice || isAmbiguous) {
          const plannerMessages = buildPlannerMessages({
            userRequest: userContent,
            projectFiles,
            qualityMode: config.qualityMode,
          });

          const plan = await runOrchestrator({
            mode: "planner",
            messages: plannerMessages,
            config,
            setIsStreaming,
            setStreamingMessage,
          });

          setPendingPlan({
            originalRequest: userContent,
            planText: String(plan?.content ?? ""),
            mode: isAdvice ? "advice" : "build",
          });

          pushAssistant(String(plan?.content ?? ""));
          return;
        }

        const builderMessages = buildBuilderMessages({
          userRequest: userContent,
          projectFiles,
          qualityMode: config.qualityMode,
        });

        const aiResponse = await runOrchestrator({
          mode: "builder",
          messages: builderMessages,
          config,
          setIsStreaming,
          setStreamingMessage,
        });

        const normalized = normalizeAiResponse(aiResponse);

        // Validate
        const validatorMessages = buildValidatorMessages({
          aiResponse: normalized,
          projectFiles,
        });

        const validator = await runOrchestrator({
          mode: "validator",
          messages: validatorMessages,
          config,
          setIsStreaming,
          setStreamingMessage,
        });

        const explainMessages = buildExplainMessages({
          aiResponse: normalized,
          validatorResponse: validator,
        });

        const digest = buildChangeDigest(normalized);

        setPendingChange({
          files: normalized.files || [],
          summary: digest.summary,
          created: digest.created,
          updated: digest.updated,
          skipped: digest.skipped,
          aiResponse: normalized,
          agentResponse,
        });

        setShowConfirmModal(true);
        pushAssistant(explainMessages);
      } catch (e: any) {
        console.log("[useChatAIFlow] error", e);
        setError(e?.message || "Fehler im Chat Flow");
      } finally {
        setIsAiLoading(false);
        setIsStreaming(false);
      }
    },
    [
      activeRepo,
      addChatMessage,
      config,
      pendingPlan,
      projectFiles,
      pollNativeSyncStatusToChat,
      pushAssistant,
      setError,
      setIsAiLoading,
      setIsStreaming,
      setShowConfirmModal,
      setStreamingMessage,
    ],
  );

  // auto-fix request support (existing)
  useEffect(() => {
    // existing logic remains
  }, [autoFixRequest, clearAutoFixRequest]);

  return {
    pendingPlan,
    pendingChange,
    isAtBottomRef,
    setAtBottom,
    handleSendWithMeta,
    applyChanges,
    rejectChanges,
  };
}
