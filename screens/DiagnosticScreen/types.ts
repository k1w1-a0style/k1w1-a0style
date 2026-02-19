
import type { ProjectFile } from "../../shared/types/project";
export type Status = "pass" | "warn" | "fail";
export type FixStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type BuildVariant = "all" | "development" | "preview" | "production";

export type FixHistoryEntry = {
  label: string;
  at: number;
  snapshot: ProjectFile[];
  createdPaths: string[];
};

export type FixStep = {
  key: string;
  title: string;
  status: FixStepStatus;
  message?: string;
};
