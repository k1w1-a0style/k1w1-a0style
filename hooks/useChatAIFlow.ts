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

  // ✅ Poll EAS status via check-eas-build und poste Updates in den Chat
  const pollEasBuildStatusToChat = useCallback(
    async (jobId: number) => {
      const url = `${CONFIG.API.SUPABASE_EDGE_URL}/check-eas-build`;

      let lastStatus = "";
      let lastHtml = "";
      let lastBuild = "";
      let lastArtifact = "";

      // 60 * 5s = 5min (reicht für queued/building + Run-Link).
      // Für lange Builds: danach kannst du "build status <jobId>" schreiben.
      for (let i = 0; i < 60; i++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.ok) {
            await sleep(5000);
            continue;
          }

          const status = String(json?.status || "").toLowerCase();
          const html = json?.urls?.html ? String(json.urls.html) : "";
          const build = json?.urls?.build ? String(json.urls.build) : "";
          const artifacts = json?.urls?.artifacts
            ? String(json.urls.artifacts)
            : "";

          const changed =
            (status && status !== lastStatus) ||
            (html && html !== lastHtml) ||
            (build && build !== lastBuild) ||
            (artifacts && artifacts !== lastArtifact);

          if (changed) {
            lastStatus = status || lastStatus;
            lastHtml = html || lastHtml;
            lastBuild = build || lastBuild;
            lastArtifact = artifacts || lastArtifact;

            const nice =
              status === "success"
                ? "✅ SUCCESS"
                : status === "failed"
                  ? "❌ FAILED"
                  : status === "building"
                    ? "⏳ BUILDING"
                    : status === "queued"
                      ? "🕒 QUEUED"
                      : status
                        ? status.toUpperCase()
                        : "…";

            let msg =
              `📦 EAS Build Status Update\n\n` +
              `🆔 JobId: ${jobId}\n` +
              `Status: ${nice}\n`;

            if (html) msg += `\n🔗 Run: ${html}\n`;
            if (build) msg += `\n🌐 Build URL: ${build}\n`;
            if (artifacts) msg += `\n📎 Artifact URL: ${artifacts}\n`;

            pushAssistant(msg.trim());
          }

          if (status === "success" || status === "failed") return;
        } catch {
          // ignore
        }

        await sleep(5000);
      }

      pushAssistant(
        `ℹ️ Build läuft wahrscheinlich noch (JobId: ${jobId}).\n` +
          `Sag einfach: "build status ${jobId}" um weiter zu checken.`,
      );
    },
    [pushAssistant],
  );

  const handleSendWithMeta = useCallback(
    async (userContent: string, _fileName?: string) => {
      const rawInput = String(userContent ?? "");
      if (!rawInput.trim()) return;

      // user message
      addChatMessage({
        id: uuidv4(),
        role: "user",
        content: userContent,
        timestamp: new Date().toISOString(),
      });

      const lower = rawInput.trim().toLowerCase();

      // ✅ EAS status only: "build status 123"
      const statusMatch = lower.match(/\b(build|eas)\s+status\s+(\d+)\b/);
      if (statusMatch) {
        const jobId = Number(statusMatch[2]);
        if (!Number.isFinite(jobId)) {
          pushAssistant("❌ Ungültige JobId.");
          return;
        }
        pushAssistant(`🔎 Checke EAS Build Status… (JobId: ${jobId})`);
        pollEasBuildStatusToChat(jobId);
        return;
      }

      // ✅ EAS build trigger by chat
      const wantsEasBuild =
        /\b(eas\s*)?build\b/.test(lower) ||
        /\b(dev|development|preview|prod|production)\b.*\b(build|apk)\b/.test(
          lower,
        );

      if (wantsEasBuild) {
        if (!activeRepo) {
          pushAssistant(
            "⚠️ Kein GitHub-Repo ausgewählt. Geh erst zu „GitHub Repos“ und wähle eins aus – dann kann ich den EAS Build starten.",
          );
          return;
        }

        // profile ableiten
        let profile: "development" | "preview" | "production" = "preview";
        if (/\b(dev|development)\b/.test(lower)) profile = "development";
        if (/\b(prod|production)\b/.test(lower)) profile = "production";
        if (/\bpreview\b/.test(lower)) profile = "preview";

        try {
          setIsAiLoading(true);

          const res = await fetch(
            `${CONFIG.API.SUPABASE_EDGE_URL}/trigger-eas-build`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                githubRepo: activeRepo,
                buildProfile: profile,
              }),
            },
          );

          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.ok || !json?.job?.id) {
            throw new Error(json?.error || `Trigger failed (${res.status})`);
          }

          const jobId = Number(json.job.id);

          pushAssistant(
            `🚀 EAS Build gestartet\n\n` +
              `Repo: ${activeRepo}\n` +
              `Profile: ${profile}\n` +
              `🆔 JobId: ${jobId}\n\n` +
              `Ich poste Status-Updates automatisch hier im Chat.`,
          );

          pollEasBuildStatusToChat(jobId);
        } catch (e: any) {
          pushAssistant(
            `❌ EAS Build fehlgeschlagen: ${e?.message || "Unbekannter Fehler"}`,
          );
        } finally {
          setIsAiLoading(false);
        }
        return;
      }

      // meta command
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

        if (pendingPlan) {
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
      pollEasBuildStatusToChat,
      projectFiles,
      pushAssistant,
      setError,
      setIsAiLoading,
      setIsStreaming,
      setShowConfirmModal,
      setStreamingMessage,
    ],
  );

  // auto-fix request support
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
