import type { LogEntry } from "../../../hooks/useGitHubActionsLogs";
import type { BuildHistoryEntry } from "../../../shared/types/build";
import type { WorkflowRun } from "../types";

const ACTIVE_BUILD_STATUSES = new Set(["starting", "queued", "building"] as const);
const FINAL_BUILD_STATUSES = new Set(["success", "failed", "error"] as const);

type BuildHistoryEntryWithBranch = BuildHistoryEntry & { branch?: string | null };

export function mapWorkflowLogsToLines(logs: LogEntry[] | null | undefined): string[] {
  if (!logs || logs.length === 0) return [];
  return logs.map((entry) => {
    if (entry.level === "raw") return entry.message;
    const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "";
    const prefix = time ? `${time} ` : "";
    return `${prefix}[${entry.level}] ${entry.message}`;
  });
}

export function resolveHistoryMatchForRun(
  run: WorkflowRun,
  history: BuildHistoryEntryWithBranch[] | null | undefined,
): { jobId: string | null; buildProfile: string | null; branch: string | null; repoName: string | null } | null {
  const all = history ?? [];
  const runUrl = String(run?.html_url || "");
  const runIdStr = String(run?.id || "");
  const hit = all.find((entry) => {
    const html = String(entry?.htmlUrl || "");
    if (html && runUrl && html === runUrl) return true;
    return html.includes(`/actions/runs/${runIdStr}`);
  });
  if (!hit) return null;
  return {
    jobId: hit.jobId ?? null,
    buildProfile: hit.buildProfile ?? null,
    branch: hit.branch ?? null,
    repoName: hit.repoName ?? null,
  };
}

export function isBuildActive(status: string, buildStartTime: number | null): boolean {
  return !!buildStartTime && ACTIVE_BUILD_STATUSES.has(status as "starting" | "queued" | "building");
}

export function isFinalBuildStatus(status: string): boolean {
  return FINAL_BUILD_STATUSES.has(status as "success" | "failed" | "error");
}

export function countHiddenRuns(filteredRunsCount: number, maxRunsDisplay: number): number {
  return filteredRunsCount > maxRunsDisplay ? filteredRunsCount - maxRunsDisplay : 0;
}
