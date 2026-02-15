// components/CiLiteHeaderButton.tsx
// Global header button: run a lightweight GitHub CI (lint + typecheck) and show logs in-app.

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { v4 as uuidv4 } from "uuid";

import * as Clipboard from "expo-clipboard";

import { theme } from "../theme";
import { ensureSupabaseClient } from "../lib/supabase";
import { getSupabaseEdgeUrl } from "../lib/supabaseEdge";
import { useGitHub } from "../contexts/GitHubContext";
import { useProject } from "../contexts/ProjectContext";
import { getDefaultBranch, getEdgeAdminKey, pushFilesToRepo } from "../contexts/githubService";
import { BuildLogsModal } from "./BuildLogsModal";
import { useGitHubActionsLogs } from "../hooks/useGitHubActionsLogs";
import { redactSecrets, truncateWithMarker } from "../lib/secretRedaction";

import type { PreflightPatch } from "../lib/diagnostics/preflightTypes";
import { validateFileContent, validateFilePath } from "../lib/validators";
import { checkPatchLimits, analyzePatchRisk, patchTouchedPaths } from "../lib/diagnostics/fixSafety";

const WORKFLOW_CI_LITE = "k1w1-ci-lite.yml";
const WORKFLOW_CI_LITE_AUTOFIX = "k1w1-ci-lite-autofix.yml";

type StepState = "idle" | "waiting" | "running" | "success" | "failure";

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
  const icon =
    state === "success"
      ? "checkmark-circle"
      : state === "failure"
        ? "close-circle"
        : state === "running"
          ? "time"
          : "ellipse";
  const color =
    state === "success"
      ? theme.palette.success
      : state === "failure"
        ? theme.palette.error
        : theme.palette.text.secondary;

  return (
    <View style={styles.stepPill}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

export default function CiLiteHeaderButton(): React.ReactElement {
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData, updateProjectFiles, deleteFile } = useProject();

  const [visible, setVisible] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string>(WORKFLOW_CI_LITE);
  const [targetRef, setTargetRef] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Optional: apply a JSON patch produced by the AI (PreflightPatch format).
  const [patchPanelOpen, setPatchPanelOpen] = useState(false);
  const [patchText, setPatchText] = useState<string>("{");
  const [patchBusy, setPatchBusy] = useState(false);
  const [patchInfo, setPatchInfo] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const githubRepo = useMemo(() => {
    return (
      projectData?.linkedRepo?.trim() || activeRepo?.trim() || ""
    ).trim();
  }, [projectData?.linkedRepo, activeRepo]);

  const branch = useMemo(() => {
    return (
      projectData?.linkedBranch?.trim() || activeBranch?.trim() || ""
    ).trim();
  }, [projectData?.linkedBranch, activeBranch]);

  const {
    logs,
    workflowRun,
    isLoading: logsLoading,
    error: logsError,
    refreshLogs,
  } = useGitHubActionsLogs({
    githubRepo: visible ? githubRepo || null : null,
    runId,
    workflowId,
    autoRefresh: visible,
  });

  const logLines = useMemo(() => {
    if (!visible) return [];
    if (!runId) {
      return [
        jobId
          ? `Warte auf GitHub Run… (job_id: ${jobId})`
          : "Warte auf GitHub Run…",
      ];
    }
    if (!logs || logs.length === 0) return [];
    return logs.map((e) => e.message);
  }, [visible, runId, logs, jobId]);

  const stepInfo = useMemo(() => inferStepStates(logLines), [logLines]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

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
    [projectData, patchBusy, validatePatchText, deleteFile, updateProjectFiles],
  );

  const topContent = useMemo(() => {
    return (
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>CI Lite</Text>
        <Text style={styles.summaryLine} numberOfLines={2}>
          Repo: {githubRepo || "(kein Repo)"}
        </Text>
        <Text style={styles.summaryLine} numberOfLines={1}>
          Branch: {targetRef || branch || "(auto)"}
        </Text>
        {jobId ? (
          <Text style={styles.summaryLine} numberOfLines={1}>
            job_id: {jobId}
          </Text>
        ) : null}

        <View style={styles.stepsRow}>
          <StepPill label="ESLint" state={stepInfo.lint} />
          <StepPill label="Typecheck" state={stepInfo.typecheck} />
        </View>

        {(stepInfo.eslintErrors > 0 || stepInfo.tsErrors > 0) ? (
          <Text style={styles.findings}>
            Funde: ESLint {stepInfo.eslintErrors} | TS {stepInfo.tsErrors}
          </Text>
        ) : null}

        {workflowRun?.status ? (
          <Text style={styles.summaryHint}>
            Status: {workflowRun.status}
            {workflowRun.conclusion ? ` / ${workflowRun.conclusion}` : ""}
          </Text>
        ) : null}

        {patchPanelOpen ? (
          <View style={styles.patchPanel}>
            <View style={styles.patchHeadRow}>
              <Text style={styles.patchTitle}>Apply Patch (JSON)</Text>
              <Pressable
                onPress={pastePatchFromClipboard}
                style={({ pressed }) => [styles.patchMiniBtn, pressed && styles.patchMiniBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Paste patch from clipboard"
              >
                <Text style={styles.patchMiniBtnText}>Paste</Text>
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
              style={styles.patchInput}
            />

            <View style={styles.patchActionsRow}>
              <Pressable
                onPress={validatePatchAndShow}
                style={({ pressed }) => [styles.patchBtn, pressed && styles.patchBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Validate patch"
              >
                <Text style={styles.patchBtnText}>Validate</Text>
              </Pressable>

              <Pressable
                onPress={applyPatchFromText}
                disabled={patchBusy}
                style={({ pressed }) => [
                  styles.patchBtn,
                  styles.patchBtnPrimary,
                  (pressed && !patchBusy) && styles.patchBtnPressed,
                  patchBusy && styles.patchBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Apply patch"
                accessibilityState={{ disabled: patchBusy }}
              >
                <Text style={styles.patchBtnText}>{patchBusy ? "Applying…" : "Apply"}</Text>
              </Pressable>

              <Pressable
                onPress={() => setPatchPanelOpen(false)}
                style={({ pressed }) => [styles.patchBtn, pressed && styles.patchBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Close patch panel"
              >
                <Text style={styles.patchBtnText}>Close</Text>
              </Pressable>
            </View>

            {patchInfo ? (
              <Text style={styles.patchInfo} numberOfLines={8}>
                {safeUi(patchInfo)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }, [
    githubRepo,
    branch,
    targetRef,
    jobId,
    stepInfo,
    workflowRun?.status,
    workflowRun?.conclusion,
    patchPanelOpen,
    patchText,
    patchBusy,
    patchInfo,
    pastePatchFromClipboard,
    validatePatchAndShow,
    applyPatchFromText,
  ]);

  const findRunByJobId = useCallback(
    async (opts: { githubRepo: string; branch: string; jobId: string; workflow: string }) => {
      const { githubRepo, branch, jobId, workflow } = opts;
      const edgeUrl = await getSupabaseEdgeUrl();
      const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

      const r = await fetch(`${edgeUrl}/github-workflow-runs`, {
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

  const dispatchWorkflow = useCallback(
    async (workflowFile: string) => {
      if (!githubRepo || !githubRepo.includes("/")) {
        Alert.alert("CI Lite", "Kein gültiges Repo (owner/repo) ausgewählt.");
        return;
      }

      if (!projectData?.files || projectData.files.length === 0) {
        Alert.alert("CI Lite", "Projekt ist leer – keine Files zum Pushen.");
        return;
      }

      setLocalError(null);
      setVisible(true);
      setDispatching(true);
      setRunId(null);
      setRunUrl(null);
      setWorkflowId(workflowFile);

      stopPolling();

      const newJobId = uuidv4();
      setJobId(newJobId);

      try {
        // 1) Best-effort: push current project files to the target branch.
        const [owner, repo] = githubRepo.split("/");
        let targetBranch = branch;
        if (!targetBranch) {
          try {
            targetBranch = (await getDefaultBranch(owner, repo)).trim();
          } catch {
            targetBranch = "main";
          }
        }

        setTargetRef(targetBranch);

        await pushFilesToRepo(owner, repo, projectData.files as any, targetBranch);

        // 2) Dispatch workflow via Edge (server-side token).
        const supabase = await ensureSupabaseClient();
        const edgeAdminKey = await getEdgeAdminKey().catch(() => null);
        const invokeOpts: { body: any; headers?: Record<string, string> } = {
          body: {
            githubRepo,
            workflow: workflowFile,
            ref: targetBranch,
            inputs: {
              ref: targetBranch,
              job_id: newJobId,
            },
          },
        };
        if (edgeAdminKey) invokeOpts.headers = { "x-k1w1-admin-key": edgeAdminKey };

        const { error } = await supabase.functions.invoke(
          "github-workflow-dispatch",
          invokeOpts,
        );
        if (error) throw error;

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
      projectData?.files,
      stopPolling,
      findRunByJobId,
    ],
  );

  const isAutofix = workflowId === WORKFLOW_CI_LITE_AUTOFIX;

  const extraPills = useMemo(() => {
    return [
      {
        label: "Open Run",
        onPress: async () => {
          const url = runUrl || workflowRun?.html_url;
          if (!url) return;
          try {
            const can = await Linking.canOpenURL(url);
            if (can) await Linking.openURL(url);
          } catch {
            // ignore
          }
        },
        disabled: !(runUrl || workflowRun?.html_url),
      },
      {
        label: patchPanelOpen ? "Hide Patch" : "Apply Patch",
        onPress: () => {
          setPatchPanelOpen((v) => !v);
          // Keep modal open and show latest validation info if present.
          if (!patchPanelOpen) setPatchInfo(null);
        },
        disabled: false,
      },
      {
        label: dispatching ? "Autofix…" : "Autofix ESLint",
        onPress: () => dispatchWorkflow(WORKFLOW_CI_LITE_AUTOFIX),
        disabled: dispatching,
      },
    ];
  }, [runUrl, workflowRun?.html_url, dispatching, dispatchWorkflow, patchPanelOpen]);

  const showError = safeUi(localError || logsError || "");

  return (
    <>
      <Pressable
        onPress={() => dispatchWorkflow(WORKFLOW_CI_LITE)}
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && styles.iconBtnPressed,
        ]}
        accessibilityLabel="CI Lite (Lint + Typecheck)"
        android_ripple={{
          color: `${theme.palette.primary}22`,
          borderless: true,
        }}
      >
        <Ionicons
          name="checkmark-done-outline"
          size={22}
          color={theme.palette.text.primary}
        />
      </Pressable>

      <BuildLogsModal
        visible={visible}
        onClose={() => {
          setVisible(false);
          stopPolling();
        }}
        title={isAutofix ? "CI: Autofix ESLint" : "CI: Lint + Typecheck"}
        topContent={topContent}
        extraPills={extraPills}
        logs={logLines}
        isLoading={dispatching || logsLoading}
        error={showError ? showError : null}
        onManualRefresh={async () => {
          // If we still don't have a runId, re-poll quickly.
          if (!runId && jobId && githubRepo) {
            try {
              const b = (targetRef || branch || "").trim();
              const found = await findRunByJobId({
                githubRepo,
                branch: b,
                jobId,
                workflow: workflowId,
              });
              if (found?.id) {
                setRunId(Number(found.id));
                setRunUrl(typeof found?.html_url === "string" ? found.html_url : null);
              }
            } catch (e: any) {
              setLocalError(e?.message || String(e));
            }
          }
          await refreshLogs();
        }}
        autoRefreshEnabled={visible}
        onToggleAutoRefresh={() => {
          // controlled by visibility (keep it simple)
        }}
        defaultOnlyErrors={true}
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  iconBtnPressed: {
    backgroundColor: theme.palette.cardHover,
  },
  summaryBox: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 12,
  },
  summaryTitle: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    marginBottom: 4,
  },
  summaryLine: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginBottom: 2,
  },
  stepsRow: {
    flexDirection: "row",
    marginTop: 8,
    flexWrap: "wrap",
  },
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  stepText: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  findings: {
    marginTop: 2,
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryHint: {
    marginTop: 2,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },

  patchPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 14,
    padding: 10,
  },
  patchHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  patchTitle: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  patchMiniBtn: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  patchMiniBtnPressed: {
    opacity: 0.85,
  },
  patchMiniBtnText: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  patchInput: {
    minHeight: 120,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 10,
    color: theme.palette.text.primary,
    fontSize: 12,
  },
  patchActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  patchBtn: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  patchBtnPrimary: {
    borderColor: theme.palette.primary,
  },
  patchBtnPressed: {
    opacity: 0.85,
  },
  patchBtnDisabled: {
    opacity: 0.55,
  },
  patchBtnText: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  patchInfo: {
    marginTop: 6,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
});
