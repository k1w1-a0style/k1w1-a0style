// components/CiLiteHeaderButton.tsx
// Global header button: run a lightweight GitHub CI (lint + typecheck) and show logs in-app.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { v4 as uuidv4 } from "uuid";

import AsyncStorage from "@react-native-async-storage/async-storage";

import * as Clipboard from "expo-clipboard";

import { theme } from "../theme";
import { getGitHubToken } from "../infra/github/tokenStore";
import { getSupabaseEdgeUrl } from "../lib/supabaseEdge";
import { SUPABASE_EDGE_FUNCTIONS } from "../shared/constants/supabase";
import { useGitHub } from "../contexts/GitHubContext";
import { useProject } from "../contexts/ProjectContext";
import { deleteRepoFile, getDefaultBranch, getEdgeAdminKey, pushFilesToRepo } from "../infra/github/githubService";
import { useGitHubActionsLogs } from "../hooks/useGitHubActionsLogs";
import { redactSecrets, truncateWithMarker } from "../lib/secretRedaction";
import { STORAGE_KEYS } from "../lib/storageKeys";

import type { PreflightPatch } from "../lib/diagnostics/preflightTypes";
import { validateFileContent, validateFilePath } from "../lib/validators";
import { checkPatchLimits, analyzePatchRisk, patchTouchedPaths } from "../lib/diagnostics/fixSafety";

const WORKFLOW_CI_LITE = "k1w1-ci-lite.yml";
const WORKFLOW_CI_LITE_AUTOFIX = "k1w1-ci-lite-autofix.yml";

type StepState = "idle" | "waiting" | "running" | "success" | "failure";

const HAIRLINE = StyleSheet.hairlineWidth;

function safeUi(s: string): string {
  return truncateWithMarker(redactSecrets(s || ""), 900, "…");
}

function inferStepStates(lines: string[]): {
  lint: StepState;
  typecheck: StepState;
  eslintErrors: number;
  tsErrors: number;
} {
  const joined = lines.join("\n");

  const lintStarted = /npm run lint:ci|eslint\s+\./i.test(joined);
  const typecheckStarted = /npm run typecheck|tsc\s+--noEmit/i.test(joined);

  const tsErrors = lines.filter((l) => /error\s+TS\d+:/i.test(l)).length;
  // ESLint (quiet) prints only errors; count typical lines containing " error  " but not TS errors.
  const eslintErrors = lines.filter(
    (l) => !/error\s+TS\d+:/i.test(l) && /\serror\s{2,}/i.test(l),
  ).length;

  const hasFailure = /Process completed with exit code\s+(?!0)\d+/i.test(joined);
  const hasSuccess = /✅\s*CI\s*Lite\s*passed|All checks passed|Done\s+in\s+\d/i.test(joined);

  const lint: StepState = lintStarted
    ? eslintErrors > 0
      ? "failure"
      : hasSuccess || /Lint \(CI\).*\s+\(\d+\)/i.test(joined)
        ? "success"
        : hasFailure
          ? "failure"
          : "running"
    : "waiting";

  const typecheck: StepState = typecheckStarted
    ? tsErrors > 0
      ? "failure"
      : hasSuccess
        ? "success"
        : hasFailure
          ? "failure"
          : "running"
    : "waiting";

  return { lint, typecheck, eslintErrors, tsErrors };
}

function normalizePreflightPatch(input: any): PreflightPatch {
  if (!input || typeof input !== "object") throw new Error("Patch JSON ist leer oder ungültig.");

  // Accept either a plain patch or { patch: ... }
  const p =
    (input as any).patch && typeof (input as any).patch === "object" ? (input as any).patch : input;

  const out: PreflightPatch = {};
  if (Array.isArray((p as any).upsert)) out.upsert = (p as any).upsert;
  if (Array.isArray((p as any).delete)) out.delete = (p as any).delete;
  if (Array.isArray((p as any).jsonMerge)) out.jsonMerge = (p as any).jsonMerge;
  if (typeof (p as any).explanation === "string") out.explanation = (p as any).explanation;

  if (!out.upsert?.length && !out.delete?.length && !out.jsonMerge?.length) {
    throw new Error("Patch hat keine Operationen (upsert/delete/jsonMerge).");
  }
  return out;
}

function StepPill({ label, state }: { label: string; state: StepState }) {
  return (
    <View style={styles.stepPill}>
      <StatusLamp state={state} size={10} />
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

function StatusLamp({
  state,
  size = 10,
}: {
  state: StepState;
  size?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  const color =
    state === "success"
      ? theme.palette.success
      : state === "failure"
        ? theme.palette.error
        : state === "running"
          ? theme.palette.primary
          : theme.palette.borderLight;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);

    if (state !== "running") return;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [state, pulse]);

  const scale =
    state === "running"
      ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] })
      : 1;
  const opacity =
    state === "running"
      ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
      : 1;

  const glowStyle =
    state === "success" || state === "running"
      ? theme.glow.primarySubtle
      : state === "failure"
        ? theme.glow.error
        : undefined;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        },
        glowStyle as any,
      ]}
    />
  );
}

function AnimatedDots({ active }: { active: boolean }) {
  const [dots, setDots] = useState<string>("");

  useEffect(() => {
    if (!active) {
      setDots("");
      return;
    }
    let n = 0;
    const t = setInterval(() => {
      n = (n + 1) % 4;
      setDots(".".repeat(n));
    }, 350);
    return () => clearInterval(t);
  }, [active]);

  return <Text style={styles.dots}>{dots}</Text>;
}

export default function CiLiteHeaderButton(): React.ReactElement {
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData, updateProjectFiles, deleteFile, addChatMessage } = useProject();

  const [visible, setVisible] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string>(WORKFLOW_CI_LITE);
  const [targetRef, setTargetRef] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Header indicator (remembers last conclusion even after modal close).
  const [headerState, setHeaderState] = useState<StepState>("idle");

  // When an autofix run succeeds, we expect a chained CI Lite run to appear.
  const [chainWaiting, setChainWaiting] = useState(false);

  // Optional: apply a JSON patch produced by the AI (PreflightPatch format).
  const [patchPanelOpen, setPatchPanelOpen] = useState(false);
  const [patchText, setPatchText] = useState<string>("{");
  const [patchBusy, setPatchBusy] = useState(false);
  const [patchInfo, setPatchInfo] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ringAnim = useRef(new Animated.Value(0)).current;
  const ringLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Progress bar (0..100)
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const shimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (headerState === "running") {
      ringLoopRef.current?.stop();
      ringAnim.setValue(0);
      ringLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      ringLoopRef.current.start();
    } else {
      ringLoopRef.current?.stop();
      ringLoopRef.current = null;
      ringAnim.setValue(0);
    }

    return () => {
      ringLoopRef.current?.stop();
    };
  }, [headerState, ringAnim]);


  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Cleanup: stop poll interval on component unmount (prevents memory leak)
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const findRunByJobId = useCallback(
    async (opts: { githubRepo: string; branch: string; jobId: string; workflow: string }) => {
      const { githubRepo, branch, jobId, workflow } = opts;
      const edgeUrl = await getSupabaseEdgeUrl();
      const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

      const r = await fetch(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_RUNS}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(edgeAdminKey ? { "x-k1w1-admin-key": edgeAdminKey } : {}),
        },
        body: JSON.stringify({
          githubRepo,
          workflowId: workflow,
          ref: branch,
          perPage: 30,
        }),
      });

      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(
          `github-workflow-runs failed (${r.status}): ${safeUi(t || r.statusText)}`,
        );
      }

      const json = await r.json();
      const runs =
        json?.data?.workflow_runs ??
        json?.workflow_runs ??
        json?.runs ??
        [];

      if (!Array.isArray(runs)) return null;

      // Prefer exact match in display_title/name where we embed job_id.
      const match = runs.find((x: any) => {
        const title = String(x?.display_title ?? x?.name ?? "");
        return title.includes(jobId);
      });
      return match ?? null;
    },
    [],
  );

  // Helpers must be declared before effects that reference them (TS strict).






  const githubRepo = useMemo(() => {
    // GitHubContext's active selections are the in-memory SoT.
    // ProjectContext persists them, but can be stale during hydration/migrations.
    return (activeRepo?.trim() || projectData?.linkedRepo?.trim() || "").trim();
  }, [activeRepo, projectData?.linkedRepo]);

  const branch = useMemo(() => {
    return (activeBranch?.trim() || projectData?.linkedBranch?.trim() || "").trim();
  }, [activeBranch, projectData?.linkedBranch]);

  const {
    logs,
    workflowRun,
    isLoading: logsLoading,
    error: logsError,
  } = useGitHubActionsLogs({
    githubRepo: visible ? githubRepo || null : null,
    runId,
    workflowId,
    autoRefresh: visible,
  });


// Progress shimmer while busy.
useEffect(() => {
  shimmerLoopRef.current?.stop();
  shimmerLoopRef.current = null;
  shimmerAnim.setValue(0);

  if (!visible) return;
  if (!(dispatching || logsLoading || workflowRun?.status === "in_progress")) return;

  shimmerLoopRef.current = Animated.loop(
    Animated.sequence([
      Animated.timing(shimmerAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.timing(shimmerAnim, { toValue: 0, duration: 1100, useNativeDriver: true }),
    ]),
  );
  shimmerLoopRef.current.start();

  return () => {
    shimmerLoopRef.current?.stop();
    shimmerLoopRef.current = null;
  };
}, [visible, dispatching, logsLoading, workflowRun?.status, shimmerAnim]);

  const logLines = useMemo(() => {
    if (!visible) return [];
    if (!runId) {
      return [
        chainWaiting && workflowId === WORKFLOW_CI_LITE
          ? `Autofix fertig – starte CI Lite (chain-run)… (job_id: ${jobId || ""})`
          : jobId
            ? `Warte auf GitHub Run… (job_id: ${jobId})`
            : "Warte auf GitHub Run…",
      ];
    }
    if (!logs || logs.length === 0) return [];
    return logs.map((e) => e.message);
  }, [visible, runId, logs, jobId, chainWaiting, workflowId]);

  const stepInfo = useMemo(() => inferStepStates(logLines), [logLines]);

  // Chain-run: if the Autofix workflow succeeded, automatically switch to the CI Lite run.
  useEffect(() => {
    if (!visible) return;
    if (workflowId !== WORKFLOW_CI_LITE_AUTOFIX) return;
    if (!workflowRun) return;
    if (workflowRun.status !== "completed" || workflowRun.conclusion !== "success") return;
    if (!jobId || !githubRepo) return;

    const b = (targetRef || branch || "").trim();
    if (!b) return;
    if (chainWaiting) return;

    setChainWaiting(true);
    setWorkflowId(WORKFLOW_CI_LITE);
    setRunId(null);
    setRunUrl(null);
    stopPolling();

    const start = Date.now();
    const poll = async () => {
      try {
        const found = await findRunByJobId({
          githubRepo,
          branch: b,
          jobId,
          workflow: WORKFLOW_CI_LITE,
        });
        if (found?.id) {
          setRunId(Number(found.id));
          setRunUrl(typeof found?.html_url === "string" ? found.html_url : null);
          setChainWaiting(false);
          stopPolling();
          return;
        }
      } catch (e: any) {
        setLocalError(e?.message || String(e));
      }

      if (Date.now() - start > 75_000) {
        setChainWaiting(false);
        stopPolling();
      }
    };

    void poll();
    pollTimerRef.current = setInterval(poll, 2500);
  }, [
    visible,
    workflowId,
    workflowRun,
    jobId,
    githubRepo,
    targetRef,
    branch,
    chainWaiting,
    stopPolling,
    findRunByJobId,
  ]);

  // Keep a small "lamp" in the header.
  useEffect(() => {
    if (dispatching) {
      setHeaderState("running");
      return;
    }
    if (!workflowRun?.status) return;
    if (workflowRun.status !== "completed") {
      setHeaderState("running");
      return;
    }
    if (workflowRun.conclusion === "success") setHeaderState("success");
    else if (workflowRun.conclusion === "failure" || workflowRun.conclusion === "cancelled")
      setHeaderState("failure");
  }, [workflowRun?.status, workflowRun?.conclusion, dispatching]);

  // Persist CI Lite results for other screens (e.g. Build checklist).
  useEffect(() => {
    if (!workflowRun) return;
    if (workflowId !== WORKFLOW_CI_LITE) return;
    if (workflowRun.status !== "completed") return;

    const conclusion = (workflowRun.conclusion || "").toLowerCase();
    const isSuccess = conclusion === "success";

    // Prefer workflow conclusion; otherwise fall back to inferred step states.
    const lintOk = isSuccess ? true : stepInfo.lint === "success";
    const typeOk = isSuccess ? true : stepInfo.typecheck === "success";
    const ts = String(Date.now());

    void AsyncStorage.multiSet([
      [STORAGE_KEYS.CI_LITE_LINT_OK, lintOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_TYPECHECK_OK, typeOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_LAST_RUN_AT, ts],
    ]).catch(() => {
      // ignore persistence failures (non-critical)
    });
  }, [workflowRun, workflowId, stepInfo.lint, stepInfo.typecheck]);


  const pastePatchFromClipboard = useCallback(async () => {
    try {
      const t = await Clipboard.getStringAsync();
      if (!t) return;
      setPatchText(t);
      setPatchInfo(null);
      setPatchPanelOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const validatePatchText = useCallback((): { patch: PreflightPatch; summary: string } => {
    const raw = patchText?.trim();
    if (!raw) throw new Error("Patch JSON ist leer.");
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
      throw new Error(`JSON Parse Fehler: ${e?.message || "invalid"}`);
    }

    const patch = normalizePreflightPatch(parsed);
    const touched = patchTouchedPaths(patch);
    const limits = checkPatchLimits(patch);
    const risk = analyzePatchRisk(patch);

    const parts: string[] = [];
    parts.push(
      `ops=${limits.magnitude.opCount}, files=${limits.magnitude.touchedCount}, chars=${limits.magnitude.charCount}`,
    );
    if (touched.length)
      parts.push(
        `touched: ${touched.slice(0, 8).join(", ")}${touched.length > 8 ? ` (+${touched.length - 8})` : ""}`,
      );
    if (risk.reasons.length) parts.push(`risk: ${risk.reasons.join(", ")}`);
    if (limits.hardFail) parts.push(`HARD-BLOCK: ${limits.reasons.join("; ")}`);
    else if (limits.softWarn) parts.push(`WARN: ${limits.reasons.join("; ")}`);

    return { patch, summary: parts.join("\n") };
  }, [patchText]);

  const validatePatchAndShow = useCallback(() => {
    try {
      const v = validatePatchText();
      setPatchInfo(v.summary);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setPatchInfo(msg);
      Alert.alert("Apply Patch", msg);
    }
  }, [validatePatchText]);

  const applyPatchFromText = useCallback(
    async () => {
      if (!projectData) {
        Alert.alert("Apply Patch", "Kein Projekt geladen.");
        return;
      }
      if (patchBusy) return;

      let patch: PreflightPatch;
      let summary = "";
      try {
        const v = validatePatchText();
        patch = v.patch;
        summary = v.summary;
      } catch (e: any) {
        const msg = e?.message || String(e);
        setPatchInfo(msg);
        Alert.alert("Apply Patch", msg);
        return;
      }

      const limits = checkPatchLimits(patch);
      const risk = analyzePatchRisk(patch);
      if (limits.hardFail) {
        Alert.alert("Apply Patch", `Blockiert: ${limits.reasons.join("; ")}`);
        return;
      }

      const needsConfirm = limits.softWarn || risk.reasons.length > 0;

      const doApply = async () => {
        setPatchBusy(true);
        try {
          const filesNow = projectData.files || [];
          const nowMap = new Map(filesNow.map((f) => [f.path, f.content] as const));

          const touchedPaths = patchTouchedPaths(patch);
          for (const p of touchedPaths) {
            const v = validateFilePath(p);
            if (!v.valid || !v.normalized) throw new Error(`Ungültiger Pfad im Patch: ${p}`);
          }

          const nextMap = new Map(nowMap);

          for (const u of patch.upsert ?? []) {
            const pv = validateFilePath(u.path);
            if (!pv.valid || !pv.normalized) throw new Error(`Ungültiger Pfad im Patch: ${u.path}`);
            const cv = validateFileContent(u.content ?? "");
            if (!cv.valid)
              throw new Error(`Ungültiger File-Content für ${u.path}: ${cv.error ?? "invalid"}`);
            nextMap.set(pv.normalized, u.content ?? "");
          }

          const deletePaths = (patch.delete ?? [])
            .map((p) => {
              const pv = validateFilePath(p);
              return pv.valid && pv.normalized ? pv.normalized : null;
            })
            .filter(Boolean) as string[];

          for (const p of deletePaths) nextMap.delete(p);

          if (patch.jsonMerge?.length) {
            const { applyJsonMergePatchSafe } = await import("../lib/diagnostics/smartPatch");
            const merged = await applyJsonMergePatchSafe(
              Array.from(nextMap.entries()).map(([path, content]) => ({ path, content })),
              patch.jsonMerge,
            );
            nextMap.clear();
            for (const f of merged) nextMap.set(f.path, f.content);
          }

          for (const p of deletePaths) {
            await deleteFile(p);
          }

          const nextFiles = Array.from(nextMap.entries()).map(([path, content]) => ({ path, content }));
          await updateProjectFiles(nextFiles);

          // Auto-Sync: after applying a patch locally, mirror touched files to the selected repo/branch.
          // This keeps "lokal" and "Repo" in sync without extra manual steps.
          try {
            if (githubRepo && githubRepo.includes("/")) {
              const [owner, repo] = githubRepo.split("/");
              let targetBranch = branch;
              if (!targetBranch) {
                try {
                  targetBranch = (await getDefaultBranch(owner, repo)).trim();
                } catch {
                  targetBranch = "main";
                }
              }
              if (!targetBranch) targetBranch = "main";

              // Ensure we have a token configured in-app (same token used for normal pushes).
              const tok = await getGitHubToken().catch(() => null);
              if (!tok) throw new Error("GitHub Token fehlt (Auto-Sync nach Patch).");

              const touched = patchTouchedPaths(patch);
              const toDelete = new Set(deletePaths);

              // Upserts / changed files (exclude deleted)
              const upserts = touched
                .filter((p) => !toDelete.has(p))
                .map((p) => ({ path: p, content: nextMap.get(p) ?? "" }))
                .filter((f) => typeof f.content === "string");

              if (upserts.length) {
                await pushFilesToRepo(owner, repo, upserts as any, targetBranch);
              }

              // Deletions
              for (const p of deletePaths) {
                await deleteRepoFile(owner, repo, p, `Delete ${p}`, targetBranch);
              }
            }
          } catch (syncErr: any) {
            // Don't fail patch apply if sync fails – show a clear hint instead.
            console.warn("[CI Lite] Auto-Sync failed:", syncErr);
            setPatchInfo((prev) => `${prev || ""}\n\n⚠️ Auto-Sync fehlgeschlagen: ${syncErr?.message || String(syncErr)}`);
          }

          setPatchInfo(`✅ Patch applied.\n${summary}`);
        } catch (e: any) {
          const msg = e?.message || String(e);
          setPatchInfo(msg);
          Alert.alert("Apply Patch", msg);
        } finally {
          setPatchBusy(false);
        }
      };

      if (!needsConfirm) {
        await doApply();
        return;
      }

      return new Promise<void>((resolve) => {
        Alert.alert(
          "Apply Patch",
          `Patch wirkt riskant/umfangreich.\n\n${summary}\n\nTrotzdem anwenden?`,
          [
            { text: "Abbrechen", style: "cancel", onPress: () => resolve() },
            {
              text: "Anwenden",
              style: "destructive",
              onPress: async () => {
                await doApply();
                resolve();
              },
            },
          ],
        );
      });
    },
    // Added githubRepo + branch: used for auto-sync push inside applyPatchFromText
    [projectData, patchBusy, validatePatchText, deleteFile, updateProjectFiles, githubRepo, branch],
  );


  const dispatchWorkflow = useCallback(
    async (workflowFile: string) => {
      if (!githubRepo || !githubRepo.includes("/")) {
        Alert.alert("CI Lite", "Kein gültiges Repo (owner/repo) ausgewählt.");
        return;
      }

      setLocalError(null);
      setVisible(true);
      setDispatching(true);
      setRunId(null);
      setRunUrl(null);
      setWorkflowId(workflowFile);
      setChainWaiting(false);

      stopPolling();

      const newJobId = uuidv4();
      setJobId(newJobId);

      try {
        // 1) Determine target branch (selected branch > default branch > main).
        const [owner, repo] = githubRepo.split("/");
        let targetBranch = branch;
        if (!targetBranch) {
          try {
            targetBranch = (await getDefaultBranch(owner, repo)).trim();
          } catch {
            targetBranch = "main";
          }
        }
        if (!targetBranch) targetBranch = "main";
        setTargetRef(targetBranch);


        // 2) Dispatch workflow via Edge (server-side token).
        // Use direct fetch instead of supabase.functions.invoke so we can show richer error details.
        const edgeAdminKey = await getEdgeAdminKey().catch(() => null);
        if (!edgeAdminKey) {
          throw new Error(
            "Edge Admin Key fehlt. Bitte im Verbindungen/Credentials Wizard setzen (Supabase Edge Admin Key).",
          );
        }

        const edgeUrl = await getSupabaseEdgeUrl();
        const dispatchBody = {
          githubRepo,
          githubToken: await getGitHubToken().catch(() => null),
          workflow: workflowFile,
          ref: targetBranch,
          inputs: {
            ref: targetBranch,
            job_id: newJobId,
          },
        };

        const r = await fetch(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_DISPATCH}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-k1w1-admin-key": edgeAdminKey,
          },
          body: JSON.stringify(dispatchBody),
        });

        if (!r.ok) {
          const t = await r.text().catch(() => "");
          const hint =
            r.status === 404
              ? " (Edge Function nicht deployed?)"
              : r.status === 401 || r.status === 403
                ? " (Admin-Key falsch/fehlt)"
                : "";
          throw new Error(
            `github-workflow-dispatch failed (${r.status}): ${safeUi(t || r.statusText)}${hint}`,
          );
        }

        // 3) Poll until run appears.
        const start = Date.now();
        const poll = async () => {
          try {
            const found = await findRunByJobId({
              githubRepo,
              branch: targetBranch,
              jobId: newJobId,
              workflow: workflowFile,
            });
            if (found?.id) {
              setRunId(Number(found.id));
              setRunUrl(typeof found?.html_url === "string" ? found.html_url : null);
              stopPolling();
              return;
            }
          } catch (e: any) {
            setLocalError(e?.message || String(e));
          }

          // Stop after 60s (workflow dispatch might be delayed, user can refresh).
          if (Date.now() - start > 60_000) {
            stopPolling();
          }
        };

        await poll();
        pollTimerRef.current = setInterval(poll, 2500);
      } catch (e: any) {
        setLocalError(e?.message || String(e));
      } finally {
        setDispatching(false);
      }
    },
    [
      githubRepo,
      branch,
      stopPolling,
      findRunByJobId,
    ],
  );

  const isAutofix = workflowId === WORKFLOW_CI_LITE_AUTOFIX;
  const showError = safeUi(localError || logsError || "");

  const onlyErrors = useMemo(() => {
    const lines = logLines || [];
    const out: string[] = [];
    for (const l of lines) {
      if (/error\s+TS\d+:/i.test(l)) out.push(l);
      else if (/\serror\s{2,}/i.test(l) && !/error\s+TS\d+:/i.test(l)) out.push(l);
      else if (/JSX element .* has no corresponding closing tag/i.test(l)) out.push(l);
      else if (/Process completed with exit code\s+(?!0)\d+/i.test(l)) out.push(l);
    }
    return out;
  }, [logLines]);

  const done = useMemo(() => {
    if (workflowRun?.status === "completed") return true;
    if (logLines?.some((l) => /Process completed with exit code/i.test(l))) return true;
    return false;
  }, [workflowRun?.status, logLines]);

  const ok = useMemo(() => {
    if (!done) return false;
    const concl = (workflowRun?.conclusion || "").toLowerCase();
    if (concl === "success") return true;
    // fallback: no errors detected
    return onlyErrors.length === 0 && !showError;
  }, [done, workflowRun?.conclusion, onlyErrors.length, showError]);

  const busy = dispatching || logsLoading || (workflowRun?.status === "in_progress");


const progressTarget = useMemo(() => {
  // Heuristic progress mapping for UX (not exact, but stable and readable)
  if (dispatching) return { pct: 10, label: "Dispatch…" };
  if (!runId && !done) return { pct: 18, label: "Warte auf Run…" };

  // If we have logs, infer which step is active
  if (stepInfo.lint === "running") return { pct: 35, label: "ESLint läuft…" };
  if (stepInfo.lint === "success" && stepInfo.typecheck === "waiting")
    return { pct: 55, label: "Starte Typecheck…" };
  if (stepInfo.typecheck === "running") return { pct: 78, label: "Typecheck läuft…" };

  if (done) return { pct: 100, label: ok ? "Fertig" : "Fertig (Fehler)" };

  // fallback
  return { pct: 25, label: "Initialisiere…" };
}, [dispatching, runId, done, stepInfo.lint, stepInfo.typecheck, ok]);

useEffect(() => {
  Animated.timing(progressAnim, {
    toValue: progressTarget.pct,
    duration: 420,
    useNativeDriver: false,
  }).start();
}, [progressTarget.pct, progressAnim]);

  const statusText = useMemo(() => {
    if (busy) {
      if (stepInfo.typecheck === "waiting" || stepInfo.typecheck === "idle") return "Lint-Check läuft";
      return "TypeScript-Check läuft";
    }
    if (done && ok) return "Alles grün";
    if (done && !ok) return "Fehler gefunden";
    return "Bereit";
  }, [busy, stepInfo.typecheck, done, ok]);

  const statusLamp: StepState = useMemo(() => {
    if (busy) return "running";
    if (done && ok) return "success";
    if (done && !ok) return "failure";
    return "waiting";
  }, [busy, done, ok]);

  const runMeta = useMemo(() => {
    if (!workflowRun?.created_at) return null;
    const created = Date.parse(workflowRun.created_at);
    const updated = Date.parse(workflowRun.updated_at || workflowRun.created_at);
    const durMs = Number.isFinite(created) && Number.isFinite(updated) ? Math.max(0, updated - created) : 0;
    const durSec = Math.round(durMs / 1000);
    const dur = durSec ? `${durSec}s` : "—";
    return {
      id: workflowRun.id,
      runNumber: workflowRun.run_number,
      status: workflowRun.status,
      conclusion: workflowRun.conclusion || "—",
      duration: dur,
      url: runUrl || workflowRun.html_url,
      updatedAt: workflowRun.updated_at,
    };
  }, [workflowRun, runUrl]);

  return (
    <>
      <Pressable
        onPress={() => {
          setVisible(true);
          dispatchWorkflow(WORKFLOW_CI_LITE);
        }}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && styles.iconBtnPressed,
          headerState === "running" && styles.ciBtnRunning,
        ]}
        accessibilityLabel="CI Lite (Lint + Typecheck)"
        android_ripple={{
          color: `${theme.palette.primary}22`,
          borderless: true,
        }}
      >
        <View style={styles.ciIconWrap}>
          {headerState === "running" ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                {
                  opacity: ringAnim.interpolate({
                    inputRange: [0, 0.4, 1],
                    outputRange: [0.9, 0.45, 0.1],
                  }),
                  transform: [
                    {
                      scale: ringAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.35],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}

          <Ionicons
            name={
              headerState === "success"
                ? "checkmark-circle"
                : headerState === "failure"
                  ? "close-circle"
                  : "checkmark-circle-outline"
            }
            size={22}
            color={headerState === "failure" ? theme.palette.error : theme.palette.primary}
          />
        </View>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setVisible(false);
          stopPolling();
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setVisible(false);
            stopPolling();
          }}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleRow}>
                <StatusLamp state={statusLamp} size={10} />
                <Text style={styles.modalTitle}>
                  {isAutofix ? "Autofix ESLint" : "CI Lite"}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setVisible(false);
                  stopPolling();
                }}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Schließen"
              >
                <Ionicons name="close" size={18} color={theme.palette.primary} />
              </Pressable>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.statusText}>{statusText}</Text>
              <AnimatedDots active={busy} />
              {busy ? (
                <ActivityIndicator size="small" color={theme.palette.primary} style={{ marginLeft: 8 }} />
              ) : null}


<View style={styles.progressWrap}>
  <View style={styles.progressMetaRow}>
    <Text style={styles.progressLabel}>{progressTarget.label}</Text>
    <Text style={styles.progressPct}>{Math.round(progressTarget.pct)}%</Text>
  </View>
  <View style={styles.progressTrack}>
    <Animated.View
      style={[
        styles.progressFill,
        {
          width: progressAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        },
      ]}
    />
    {busy ? (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.progressShimmer,
          {
            transform: [
              {
                translateX: shimmerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 260],
                }),
              },
            ],
          },
        ]}
      />
    ) : null}
  </View>
</View>
            </View>

            <View style={styles.metaBox}>
              <Text style={styles.metaLine} numberOfLines={1}>
                Repo: {githubRepo || "(kein Repo)"}
              </Text>
              <Text style={styles.metaLine} numberOfLines={1}>
                Branch: {targetRef || branch || "(auto)"}
              </Text>
              {jobId ? (
                <Text style={styles.metaLine} numberOfLines={1}>
                  job_id: {jobId}
                </Text>
              ) : null}

              <View style={styles.stepsCompactRow}>
                <View style={styles.stepCompact}>
                  <StatusLamp state={stepInfo.lint} size={9} />
                  <Text style={styles.stepCompactText}>ESLint</Text>
                </View>
                <View style={styles.stepCompact}>
                  <StatusLamp state={stepInfo.typecheck} size={9} />
                  <Text style={styles.stepCompactText}>Typecheck</Text>
                </View>
              </View>

              {runMeta ? (
                <View style={styles.runMetaRow}>
                  <Text style={styles.metaLine} numberOfLines={1}>
                    Run #{runMeta.runNumber} · {runMeta.status} · {String(runMeta.conclusion)} · {runMeta.duration}
                  </Text>
                </View>
              ) : null}
            </View>

            {showError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={theme.palette.error} />
                <Text style={styles.errorText}>{showError}</Text>
              </View>
            ) : null}

            <View style={styles.resultsHead}>
              <Text style={styles.resultsTitle}>Ergebnisse</Text>
              {done ? (
                ok ? (
                  <Text style={styles.okText}>✅ OK</Text>
                ) : (
                  <Text style={styles.badText}>❌ Fehler</Text>
                )
              ) : (
                <Text style={styles.waitText}>…</Text>
              )}
            </View>

            <View style={styles.resultsBox}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {done && ok && onlyErrors.length === 0 ? (
                  <Text style={styles.okHint}>Keine Fehler gefunden.</Text>
                ) : null}

                {onlyErrors.map((l, idx) => (
                  <Text key={`${idx}-${l.slice(0, 24)}`} style={styles.logLine}>
                    {safeUi(l)}
                  </Text>
                ))}
              </ScrollView>
            </View>

            {patchPanelOpen ? (
              <View style={styles.patchPanelCompact}>
                <View style={styles.patchTopRow}>
                  <Text style={styles.patchTitleCompact}>Apply Patch (JSON)</Text>
                  <Pressable
                    onPress={pastePatchFromClipboard}
                    style={({ pressed }) => [styles.tinyBtn, pressed && styles.tinyBtnPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Paste"
                  >
                    <Text style={styles.tinyBtnText}>Paste</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={patchText}
                  onChangeText={setPatchText}
                  placeholder='{"upsert":[{"path":"...","content":"..."}]}'
                  placeholderTextColor={theme.palette.text.secondary}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.patchInputCompact}
                />
                <View style={styles.patchBtnRow}>
                  <Pressable
                    onPress={validatePatchAndShow}
                    style={({ pressed }) => [styles.tinyBtn, pressed && styles.tinyBtnPressed]}
                  >
                    <Text style={styles.tinyBtnText}>Validate</Text>
                  </Pressable>
                  <Pressable
                    onPress={applyPatchFromText}
                    disabled={patchBusy}
                    style={({ pressed }) => [
                      styles.tinyBtn,
                      styles.tinyBtnPrimary,
                      pressed && !patchBusy && styles.tinyBtnPressed,
                      patchBusy && styles.tinyBtnDisabled,
                    ]}
                  >
                    <Text style={styles.tinyBtnText}>{patchBusy ? "Applying…" : "Apply"}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPatchPanelOpen(false)}
                    style={({ pressed }) => [styles.tinyBtn, pressed && styles.tinyBtnPressed]}
                  >
                    <Text style={styles.tinyBtnText}>Close</Text>
                  </Pressable>
                </View>
                {patchInfo ? (
                  <Text style={styles.patchInfoCompact} numberOfLines={8}>
                    {safeUi(patchInfo)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={async () => {
                  const joined = safeUi(onlyErrors.join("\n"));
                  if (!joined.trim()) {
                    Alert.alert("CI Lite", "Keine Fehler gefunden – nichts an den Chat zu schicken.");
                    return;
                  }
                  try {
                    await addChatMessage({
                      id: uuidv4(),
                      role: "user",
                      timestamp: new Date().toISOString(),
                      content: `CI Lite Fehler (ESLint/Typecheck)\n\n${joined}`,
                      meta: { error: true },
                    });
                    Alert.alert("In Chat übernommen", "Fehler wurden als Nachricht in den Chat eingefügt.");
                  } catch {
                    Alert.alert("Fehler", "Konnte die Nachricht nicht in den Chat schreiben.");
                  }
                }}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.palette.primary} />
                <Text style={styles.actionBtnText}>Chat</Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  try {
                    const joined = safeUi(onlyErrors.join("\n"));
                    await Clipboard.setStringAsync(joined || "(keine Fehler)");
                  } catch {
                    // ignore
                  }
                }}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <Ionicons name="copy-outline" size={16} color={theme.palette.primary} />
                <Text style={styles.actionBtnText}>Copy</Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  const url = runUrl || workflowRun?.html_url;
                  if (!url) return;
                  try {
                    const can = await Linking.canOpenURL(url);
                    if (can) await Linking.openURL(url);
                  } catch {
                    // ignore
                  }
                }}
                disabled={!(runUrl || workflowRun?.html_url)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  !(runUrl || workflowRun?.html_url) && styles.actionBtnDisabled,
                  pressed && (runUrl || workflowRun?.html_url) && styles.actionBtnPressed,
                ]}
              >
                <Ionicons name="open-outline" size={16} color={theme.palette.primary} />
                <Text style={styles.actionBtnText}>Run</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setPatchPanelOpen(true);
                  setPatchInfo(null);
                }}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <Ionicons name="hammer-outline" size={16} color={theme.palette.primary} />
                <Text style={styles.actionBtnText}>Patch</Text>
              </Pressable>

              <Pressable
                onPress={() => dispatchWorkflow(WORKFLOW_CI_LITE_AUTOFIX)}
                disabled={dispatching}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  dispatching && styles.actionBtnDisabled,
                  pressed && !dispatching && styles.actionBtnPressed,
                ]}
              >
                <Ionicons name="flash-outline" size={16} color={theme.palette.background} />
                <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
                  {dispatching ? "…" : "Autofix"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.background,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}22`,
  },
  iconBtnPressed: {
    backgroundColor: theme.palette.userBubble.background,
  },
  // ciBtn: removed – was defined but never used in JSX
  ciBtnRunning: {
    borderColor: theme.palette.primary,
    ...theme.glow.primary,
  },
  ciIconWrap: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}66`,
    ...theme.glow.primary,
  },

  // --- Compact modal UI (center card) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}2a`,
    backgroundColor: theme.palette.card,
    padding: 14,
    ...(theme.glow.primarySubtle as any),
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}22`,
    backgroundColor: theme.palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnPressed: {
    opacity: 0.85,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  statusText: {
    color: theme.palette.text.secondary,
    fontWeight: "800",
    fontSize: 12,
  },
  dots: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 12,
    marginLeft: 2,
  },
  progressWrap: {
    marginTop: 8,
    marginBottom: 2,
    width: "100%",
  },
  progressMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    color: theme.palette.text.secondary,
    fontWeight: "800",
    fontSize: 12,
  },
  progressPct: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 12,
  },
  progressTrack: {
    position: "relative",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: `${theme.palette.primary}1a`,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}22`,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.palette.primary,
    opacity: 0.75,
  },
  progressShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    borderRadius: 999,
    backgroundColor: `${theme.palette.primary}55`,
    opacity: 0.35,
  },
  metaBox: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 16,
    padding: 12,
  },
  metaLine: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginBottom: 3,
  },
  runMetaRow: {
    marginTop: 6,
  },
  stepsCompactRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  stepCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  stepCompactText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },

  // --- Legacy/compat style keys (kept to avoid TS errors after UI refactors) ---
  // These map older names used by helper components (StepPill / Patch panel) to
  // the current compact modal style system.
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  stepText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${theme.palette.error}44`,
    backgroundColor: "rgba(255,68,68,0.08)",
  },
  errorText: {
    flex: 1,
    color: theme.palette.text.primary,
    fontSize: 12,
  },
  resultsHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
  },
  resultsTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  okText: {
    color: theme.palette.primary,
    fontWeight: "900",
  },
  badText: {
    color: theme.palette.error,
    fontWeight: "900",
  },
  waitText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
  },
  resultsBox: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 16,
    padding: 10,
    maxHeight: 260,
  },
  okHint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    paddingVertical: 6,
  },
  logLine: {
    color: theme.palette.text.primary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },

  patchPanelCompact: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 16,
    padding: 10,
  },
  patchTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  patchTitleCompact: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  patchInputCompact: {
    minHeight: 90,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 10,
    color: theme.palette.text.primary,
    fontSize: 12,
  },
  patchBtnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  patchInfoCompact: {
    marginTop: 10,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },

  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}22`,
    backgroundColor: theme.palette.background,
    minWidth: 92,
  },
  actionBtnPrimary: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
    ...(theme.glow.primarySubtle as any),
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  actionBtnTextPrimary: {
    color: theme.palette.background,
  },

  tinyBtn: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tinyBtnPrimary: {
    borderColor: theme.palette.primary,
  },
  tinyBtnPressed: {
    opacity: 0.85,
  },
  tinyBtnDisabled: {
    opacity: 0.55,
  },
  tinyBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },
});
