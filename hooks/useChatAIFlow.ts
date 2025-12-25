import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const STORAGE_KEYS = {
  lastRepo: "k1w1:last_repo",
  lastNativeJobId: "k1w1:last_native_sync_job_id",
  lastEasJobId: "k1w1:last_eas_job_id",
};

async function safeSet(key: string, value: string) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
}

async function safeGet(key: string) {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

  // keep one poller at a time
  const pollAbortRef = useRef<{ aborted: boolean }>({ aborted: false });

  useEffect(() => {
    // auto-save active repo
    if (activeRepo) safeSet(STORAGE_KEYS.lastRepo, String(activeRepo));
  }, [activeRepo]);

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

  const pollNativeSyncToChat = useCallback(
    async (jobId: string) => {
      const abort = { aborted: false };
      pollAbortRef.current = abort;

      let lastStatus = "";
      let lastRunUrl = "";

      for (let i = 0; i < 180; i++) {
        if (abort.aborted) return;

        try {
          const res = await fetch(
            `${CONFIG.API.SUPABASE_EDGE_URL}/check-native-sync`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId }),
            },
          );
          const json = await res.json().catch(() => ({}));

          if (!res.ok || !json?.ok) {
            if (i === 0)
              pushAssistant(
                `⚠️ Native-Sync Status: Server antwortet nicht sauber (HTTP ${res.status}).`,
              );
            await sleep(5000);
            continue;
          }

          const status = String(json?.status || json?.job?.status || "unknown");
          const runUrl = String(json?.run?.html_url || "");

          if (status !== lastStatus || (runUrl && runUrl !== lastRunUrl)) {
            lastStatus = status;
            lastRunUrl = runUrl;

            const nice =
              status === "queued" || status === "dispatched"
                ? "⏳ queued"
                : status === "running"
                  ? "🧠 running"
                  : status === "success"
                    ? "✅ success"
                    : status === "failed" || status === "error"
                      ? "❌ failed"
                      : `ℹ️ ${status}`;

            pushAssistant(
              `🧩 Native-Sync Status Update\n- JobId: ${jobId}\n- Status: ${nice}${
                runUrl ? `\n- GitHub Run: ${runUrl}` : ""
              }`,
            );

            if (
              status === "success" ||
              status === "failed" ||
              status === "error"
            ) {
              // also try to fetch last report
              try {
                const r2 = await fetch(
                  `${CONFIG.API.SUPABASE_EDGE_URL}/native-sync-report`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jobId }),
                  },
                );
                const j2 = await r2.json().catch(() => ({}));
                const rep = j2?.report?.report;

                if (rep) {
                  const missing = rep?.missing?.deps?.length ?? 0;
                  const topMissing = Array.isArray(rep?.missing?.deps)
                    ? rep.missing.deps.slice(0, 12)
                    : [];
                  pushAssistant(
                    `📄 Native-Sync Report (latest)\n- Missing: ${missing}\n${
                      topMissing.length
                        ? `- Top:\n${topMissing.map((x: string) => `  • ${x}`).join("\n")}`
                        : ""
                    }`,
                  );
                }
              } catch {}
              return;
            }
          }
        } catch {}

        await sleep(5000);
      }

      pushAssistant(
        `⚠️ Native-Sync: Timeout beim Status-Polling (JobId: ${jobId}).`,
      );
    },
    [pushAssistant],
  );

  const pollEasBuildToChat = useCallback(
    async (jobId: string) => {
      const abort = { aborted: false };
      pollAbortRef.current = abort;

      let lastStatus = "";
      let lastUrl = "";
      let lastArtifact = "";

      for (let i = 0; i < 180; i++) {
        if (abort.aborted) return;

        try {
          const res = await fetch(
            `${CONFIG.API.SUPABASE_EDGE_URL}/check-eas-build`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId }),
            },
          );
          const json = await res.json().catch(() => ({}));

          if (!res.ok || !json?.ok) {
            if (i === 0)
              pushAssistant(
                `⚠️ EAS Status: Server antwortet nicht sauber (HTTP ${res.status}).`,
              );
            await sleep(5000);
            continue;
          }

          const status = String(json?.status || "unknown");
          const html = String(json?.urls?.html || "");
          const artifact = String(json?.urls?.artifacts || "");

          const changed =
            status !== lastStatus ||
            (html && html !== lastUrl) ||
            (artifact && artifact !== lastArtifact);

          if (changed) {
            lastStatus = status;
            lastUrl = html;
            lastArtifact = artifact;

            const nice =
              status === "queued"
                ? "⏳ queued"
                : status === "building"
                  ? "🏗️ building"
                  : status === "success"
                    ? "✅ success"
                    : status === "failed"
                      ? "❌ failed"
                      : `ℹ️ ${status}`;

            pushAssistant(
              `📦 EAS Build Status Update\n- JobId: ${jobId}\n- Status: ${nice}${
                html ? `\n- GitHub Run: ${html}` : ""
              }${artifact ? `\n- Artifact: ${artifact}` : ""}`,
            );

            if (status === "success" || status === "failed") return;
          }
        } catch {}

        await sleep(5000);
      }

      pushAssistant(
        `⚠️ EAS Build: Timeout beim Status-Polling (JobId: ${jobId}).`,
      );
    },
    [pushAssistant],
  );

  const handleSendWithMeta = useCallback(
    async (userContent: string, fileName?: string) => {
      const rawInput = String(userContent ?? "");
      if (!rawInput.trim() && !fileName) return;

      // user message
      addChatMessage({
        id: uuidv4(),
        role: "user",
        content: fileName
          ? `${userContent}\n\n📎 Datei: ${fileName}`
          : userContent,
        timestamp: new Date().toISOString(),
      });

      // abort old polling if new command arrives
      pollAbortRef.current.aborted = true;

      // --- local commands (no LLM) ---
      const wantsSyncNative =
        /(\b(sync|scan|update|aktualisiere|prüfe|checke)\b.*\b(dep|deps|dependencies|defenses|native)\b)/i.test(
          rawInput,
        ) ||
        /(\bdev\b.*\b(apk|build)\b.*\b(dep|deps|dependencies|defenses)\b)/i.test(
          rawInput,
        );

      const wantsEasBuild =
        /(\b(build|baue|erstelle)\b.*\b(apk|dev build|development build|eas)\b)/i.test(
          rawInput,
        ) || /(\beas\b.*\b(build|apk)\b)/i.test(rawInput);

      if (wantsSyncNative) {
        if (!activeRepo) {
          pushAssistant(
            "⚠️ Kein GitHub-Repo ausgewählt. Geh erst zu „GitHub Repos“ und wähle eins aus – dann kann ich die Dependencies syncen.",
          );
          return;
        }

        try {
          setIsAiLoading(true);

          const createPr = /\bpr\b/i.test(rawInput);
          const apply = !/\b(dry|dry-run|nur scan|scan only)\b/i.test(rawInput);

          // use new edge function trigger-native-sync
          const res = await fetch(
            `${CONFIG.API.SUPABASE_EDGE_URL}/trigger-native-sync`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                githubRepo: activeRepo,
                ref: "main",
                base_ref: "main",
                apply: apply ? "true" : "false",
                create_pr: createPr ? "true" : "false",
              }),
            },
          );

          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.ok)
            throw new Error(json?.error || `Dispatch failed (${res.status})`);

          const jobId = String(json.jobId);
          await safeSet(STORAGE_KEYS.lastNativeJobId, jobId);
          await safeSet(STORAGE_KEYS.lastRepo, String(activeRepo));

          pushAssistant(
            `🧩 Native-Dependency Sync gestartet.\n- Repo: ${activeRepo}\n- JobId: ${jobId}\n\nIch logge den Status jetzt automatisch hier rein.\n(Tipp: sag „sync deps + PR“ wenn du direkt ne PR willst.)`,
          );

          pollNativeSyncToChat(jobId);
        } catch (e: any) {
          pushAssistant(
            `❌ Native-Sync fehlgeschlagen: ${e?.message || "Unbekannter Fehler"}`,
          );
        } finally {
          setIsAiLoading(false);
        }

        return;
      }

      if (wantsEasBuild) {
        if (!activeRepo) {
          pushAssistant(
            "⚠️ Kein GitHub-Repo ausgewählt. Geh erst zu „GitHub Repos“ und wähle eins aus – dann kann ich den Build starten.",
          );
          return;
        }

        try {
          setIsAiLoading(true);

          const profile = /\b(prod|production|release)\b/i.test(rawInput)
            ? "production"
            : "preview";

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
          if (!res.ok || !json?.ok)
            throw new Error(json?.error || `Dispatch failed (${res.status})`);

          const jobId = String(json?.job?.id ?? json?.jobId ?? "");
          if (!jobId)
            throw new Error("No jobId returned from trigger-eas-build");

          await safeSet(STORAGE_KEYS.lastEasJobId, jobId);
          await safeSet(STORAGE_KEYS.lastRepo, String(activeRepo));

          pushAssistant(
            `📦 EAS Build gestartet.\n- Repo: ${activeRepo}\n- Profile: ${profile}\n- JobId: ${jobId}\n\nIch logge den Status jetzt automatisch hier rein.`,
          );

          pollEasBuildToChat(jobId);
        } catch (e: any) {
          pushAssistant(
            `❌ EAS Build fehlgeschlagen: ${e?.message || "Unbekannter Fehler"}`,
          );
        } finally {
          setIsAiLoading(false);
        }

        return;
      }

      // meta commands (existing)
      const metaResult = handleMetaCommand(rawInput.trim(), projectFiles);
      if (metaResult.handled && metaResult.message) {
        addChatMessage(metaResult.message);
        return;
      }

      // --- existing planner/builder/validator flow ---
      try {
        setError(null);
        setIsAiLoading(true);
        setIsStreaming(false);
        setStreamingMessage("");

        if (pendingPlan) {
          const lower = rawInput.trim().toLowerCase();
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

        const isExplicit = looksLikeExplicitFileTask(rawInput);
        const isAdvice = looksLikeAdviceRequest(rawInput);
        const isAmbiguous = looksAmbiguousBuilderRequest(rawInput);

        let agentResponse: any = null;

        if (isAdvice || isAmbiguous) {
          const plannerMessages = buildPlannerMessages({
            userRequest: rawInput,
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
            originalRequest: rawInput,
            planText: String(plan?.content ?? ""),
            mode: isAdvice ? "advice" : "build",
          });

          pushAssistant(String(plan?.content ?? ""));
          return;
        }

        const builderMessages = buildBuilderMessages({
          userRequest: rawInput,
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
      hardScrollToBottom,
      pendingPlan,
      pollEasBuildToChat,
      pollNativeSyncToChat,
      projectFiles,
      pushAssistant,
      setError,
      setIsAiLoading,
      setIsStreaming,
      setShowConfirmModal,
      setStreamingMessage,
    ],
  );

  // auto-fix request support (unchanged placeholder)
  useEffect(() => {
    // Dein vorhandenes AutoFix Verhalten bleibt wie es ist.
    // (Du hattest das bereits in ProjectContext/DiagnosticScreen verdrahtet)
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
