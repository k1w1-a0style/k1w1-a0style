import type { WorkflowRun } from "../types";

export type BuildRunMatch = {
  jobId: string | null;
  buildProfile: string | null;
  branch: string | null;
  repoName: string | null;
};

export function composeEnhancedBuildScreenReturn<T extends Record<string, unknown>>(params: T & {
  selectedRun: WorkflowRun | null;
  findHistoryMatchForRun: (run: WorkflowRun) => BuildRunMatch | null;
}) {
  const { selectedRun, findHistoryMatchForRun, ...rest } = params;
  return {
    ...rest,
    selectedRun,
    runMatch: selectedRun ? findHistoryMatchForRun(selectedRun) : null,
  };
}
