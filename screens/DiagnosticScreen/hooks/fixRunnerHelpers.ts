import type { FixStep, FixStepStatus } from "../types";

type StepSpec = { key: string; title: string };

type IssueFixStepPlanParams = {
  hasPatch: boolean;
  hasDispatch: boolean;
  doSync: boolean;
  rerunAfterFix: boolean;
};

type SingleFixStepPlanParams = {
  doSync: boolean;
  rerunAfterFix: boolean;
};

type BatchFixStepPlanItem = {
  id: string;
  title: string;
  doSync: boolean;
};

const toPendingStep = ({ key, title }: StepSpec): FixStep => ({
  key,
  title,
  status: "pending" as FixStepStatus,
});

export const buildIssueFixSteps = (params: IssueFixStepPlanParams): FixStep[] => {
  const steps: StepSpec[] = [];
  if (params.hasPatch) {
    steps.push({ key: "apply", title: "Patch lokal anwenden" });
  }
  if (params.hasDispatch) {
    steps.push({ key: "dispatch", title: "Workflow-Fix starten" });
  }
  if (params.doSync) {
    steps.push({ key: "sync", title: "Änderung ins Repo syncen" });
  }
  if (params.rerunAfterFix) {
    steps.push({ key: "rerun", title: "Diagnostics erneut prüfen" });
  }
  return steps.map(toPendingStep);
};

export const buildSingleFixSteps = (params: SingleFixStepPlanParams): FixStep[] => {
  const steps: StepSpec[] = [{ key: "apply", title: "Patch lokal anwenden" }];
  if (params.doSync) {
    steps.push({ key: "sync", title: "Änderung ins Repo syncen" });
  }
  if (params.rerunAfterFix) {
    steps.push({ key: "rerun", title: "Diagnostics erneut prüfen" });
  }
  return steps.map(toPendingStep);
};

export const buildBatchFixSteps = (
  items: BatchFixStepPlanItem[],
  rerunAfterFix: boolean,
): FixStep[] => {
  const steps: StepSpec[] = [];
  for (const item of items) {
    steps.push({ key: `apply:${item.id}`, title: `Patch: ${item.title}` });
    if (item.doSync) {
      steps.push({ key: `sync:${item.id}`, title: `Sync: ${item.title}` });
    }
  }
  if (rerunAfterFix) {
    steps.push({ key: "rerun", title: "Diagnostics erneut prüfen" });
  }
  return steps.map(toPendingStep);
};

export const setStepStatusAtIndex = (
  steps: FixStep[],
  stepIndex: number,
  patch: Partial<FixStep>,
): FixStep[] => steps.map((step, index) => (index === stepIndex ? { ...step, ...patch } : step));
