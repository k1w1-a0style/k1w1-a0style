// components/CiLiteHeaderButton.tsx
// Global header button: run a lightweight GitHub CI (lint + typecheck) and show logs in-app.

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { v4 as uuidv4 } from "uuid";

import { theme } from "../theme";
import { ensureSupabaseClient } from "../lib/supabase";
import { getSupabaseEdgeUrl } from "../lib/supabaseEdge";
import { useGitHub } from "../contexts/GitHubContext";
import { useProject } from "../contexts/ProjectContext";
import { getDefaultBranch, getEdgeAdminKey, pushFilesToRepo } from "../contexts/githubService";
import { BuildLogsModal } from "./BuildLogsModal";
import { useGitHubActionsLogs } from "../hooks/useGitHubActionsLogs";
import { redactSecrets, truncateWithMarker } from "../lib/secretRedaction";

const WORKFLOW_FILE = "k1w1-ci-lite.yml";

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
  const { projectData } = useProject();

  const [visible, setVisible] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [targetRef, setTargetRef] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
    workflowId: WORKFLOW_FILE,
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
      </View>
    );
  }, [githubRepo, branch, targetRef, jobId, stepInfo, workflowRun?.status, workflowRun?.conclusion]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const findRunByJobId = useCallback(
    async (opts: { githubRepo: string; branch: string; jobId: string }) => {
      const { githubRepo, branch, jobId } = opts;
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
          workflowId: WORKFLOW_FILE,
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

  const dispatchCiLite = useCallback(
    async (autofix: boolean) => {
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
            workflow: WORKFLOW_FILE,
            ref: targetBranch,
            inputs: {
              ref: targetBranch,
              job_id: newJobId,
              autofix: autofix ? "true" : "false",
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
        label: dispatching ? "Autofix…" : "Autofix ESLint",
        onPress: () => dispatchCiLite(true),
        disabled: dispatching,
      },
    ];
  }, [runUrl, workflowRun?.html_url, dispatching, dispatchCiLite]);

  const showError = safeUi(localError || logsError || "");

  return (
    <>
      <Pressable
        onPress={() => dispatchCiLite(false)}
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
        title="CI: Lint + Typecheck"
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
              const found = await findRunByJobId({ githubRepo, branch: b, jobId });
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
});
