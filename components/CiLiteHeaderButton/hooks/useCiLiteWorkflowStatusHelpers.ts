import type { StepState } from "../types";

type WorkflowRunLike = {
  status?: string | null;
  conclusion?: string | null;
} | null;

type HydratedSnapshotLike = {
  conclusion: string;
} | null;

export function deriveCiLiteHeaderState(input: {
  dispatching: boolean;
  locatingRun: boolean;
  chainWaiting: boolean;
  workflowRun: WorkflowRunLike;
  hydratedDisplaySnapshot: HydratedSnapshotLike;
}): StepState {
  const { dispatching, locatingRun, chainWaiting, workflowRun, hydratedDisplaySnapshot } = input;

  if (dispatching || locatingRun || chainWaiting) {
    return "running";
  }

  const status = String(workflowRun?.status || "").trim();
  if (status) {
    if (status !== "completed") return "running";

    const conclusion = String(workflowRun?.conclusion || "").trim();
    if (conclusion === "success") return "success";
    if (conclusion === "failure" || conclusion === "cancelled") return "failure";
    return "idle";
  }

  if (hydratedDisplaySnapshot) {
    return hydratedDisplaySnapshot.conclusion === "success" ? "success" : "failure";
  }

  return "idle";
}
