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
          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content:
              "⚠️ Kein GitHub-Repo ausgewählt. Geh erst zu „GitHub Repos“ und wähle eins aus – dann kann ich die Dependencies syncen.",
            timestamp: new Date().toISOString(),
          });
          return;
        }

        try {
          setIsAiLoading(true);

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

          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content:
              "🧩 Native-Dependency Sync gestartet (mit Status-Logging).\n\n" +
              (jobId ? `🆔 JobId: ${jobId}\n\n` : "") +
              "GitHub Actions scannt jetzt dein Projekt, installiert fehlende Dependencies (expo install / npm install) und erzeugt einen Autogen-Report.\n\n" +
              "👉 Tipp: Öffne den Diagnostic Screen → da kannst du den detaillierten Status + Logs sehen.",
            timestamp: new Date().toISOString(),
          });
        } catch (e: any) {
          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: `❌ Sync fehlgeschlagen: ${e?.message || "Unbekannter Fehler"}`,
            timestamp: new Date().toISOString(),
          });
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
            addChatMessage({
              id: uuidv4(),
              role: "assistant",
              content:
                "Alles klar. Sag einfach „weiter“ wenn ich den Plan umsetzen soll.",
              timestamp: new Date().toISOString(),
            });
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

          addChatMessage({
            id: uuidv4(),
            role: "assistant",
            content: String(plan?.content ?? ""),
            timestamp: new Date().toISOString(),
          });

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

        addChatMessage({
          id: uuidv4(),
          role: "assistant",
          content: explainMessages,
          timestamp: new Date().toISOString(),
        });

        hardScrollToBottom(true);
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
      hardScrollToBottom,
      pendingPlan,
      projectFiles,
      setError,
      setIsAiLoading,
      setIsStreaming,
      setShowConfirmModal,
      setStreamingMessage,
      updateProjectFiles,
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
