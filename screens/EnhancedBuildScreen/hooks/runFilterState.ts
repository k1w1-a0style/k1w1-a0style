import type { WorkflowRun } from "../types";

export type ModeFilter = "all" | "development" | "preview" | "production";

export function filterWorkflowRunsByProfile(
  runs: WorkflowRun[],
  actionsFilter: ModeFilter,
): WorkflowRun[] {
  if (actionsFilter === "all") return runs;

  const needle = String(actionsFilter).toLowerCase();
  const re = new RegExp(`\\b${needle}\\b`, "i");

  return runs.filter((run) => {
    const title = String(run.display_title || "");
    const name = String(run.name || "");
    return re.test(title) || re.test(name);
  });
}

export function getWorkflowRunsEmptyStateText(params: {
  actionsFilter: ModeFilter;
  filteredRunsCount: number;
  allRunsCount: number;
}): string | null {
  const { actionsFilter, filteredRunsCount, allRunsCount } = params;
  if (actionsFilter === "all") return null;
  if (filteredRunsCount > 0) return null;
  if (allRunsCount === 0) return null;
  return `Keine Builds für dieses Profil gefunden (Filter: ${actionsFilter}).`;
}
