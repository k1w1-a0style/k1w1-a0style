import type { WorkflowRun } from "../../../hooks/actionsLogsTypes";
import type { CiLiteRunMeta } from "../../ciLite/ciLiteUtils";

export const collectCiLiteErrorLines = (logLines: string[]): string[] => {
  const out: string[] = [];
  for (const line of logLines) {
    if (/error\s+TS\d+:/i.test(line)) out.push(line);
    else if (/\serror\s{2,}/i.test(line) && !/error\s+TS\d+:/i.test(line)) out.push(line);
    else if (/JSX element .* has no corresponding closing tag/i.test(line)) out.push(line);
    else if (/Process completed with exit code\s+(?!0)\d+/i.test(line)) out.push(line);
  }
  return out;
};

export const resolveEffectiveCiLiteWorkflowRun = (params: {
  workflowRun: CiLiteRunMeta;
  hydratedConclusion: string | null | undefined;
}): CiLiteRunMeta => {
  if (params.workflowRun) return params.workflowRun;
  const hydratedConclusion = String(params.hydratedConclusion ?? "").trim();
  if (!hydratedConclusion) return null;
  return { status: "completed", conclusion: hydratedConclusion };
};

export const resolveCiLiteDone = (params: {
  workflowStatus: string | null | undefined;
  hasHydratedSnapshot: boolean;
  logLines: string[];
}): boolean => {
  if (params.workflowStatus === "completed") return true;
  if (params.hasHydratedSnapshot) return true;
  return params.logLines.some((line) => /Process completed with exit code/i.test(line));
};

export const buildCiLiteRunMeta = (params: {
  workflowRun: WorkflowRun | null;
  runUrl: string | null;
}): {
  id: number;
  runNumber: number;
  status: string;
  conclusion: string;
  duration: string;
  url: string | null;
  updatedAt: string;
} | null => {
  const workflowRun = params.workflowRun;
  if (!workflowRun?.created_at) return null;
  const created = Date.parse(workflowRun.created_at);
  const updated = Date.parse(workflowRun.updated_at || workflowRun.created_at);
  const durMs = Number.isFinite(created) && Number.isFinite(updated) ? Math.max(0, updated - created) : 0;
  const durSec = Math.round(durMs / 1000);
  return {
    id: workflowRun.id,
    runNumber: workflowRun.run_number,
    status: workflowRun.status,
    conclusion: workflowRun.conclusion || "—",
    duration: durSec ? `${durSec}s` : "—",
    url: params.runUrl || workflowRun.html_url,
    updatedAt: workflowRun.updated_at,
  };
};
