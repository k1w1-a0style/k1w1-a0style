// lib/diagnostics/preflightTypes.ts

import type { ProjectFile } from "../../contexts/types";

export type PreflightTarget =
  | { mode: "expoGo" }
  | { mode: "eas"; profile: "development" | "preview" | "production" };

export type PreflightStatus = "pass" | "warn" | "fail";
export type PreflightSeverity = "critical" | "high" | "normal" | "low";

export type PreflightPatch = {
  /**
   * Full-file upserts (will replace the file content).
   */
  upsert?: Array<{ path: string; content: string }>;
  /**
   * Delete paths.
   */
  delete?: string[];
  /**
   * Smart JSON merge patch (merges only provided keys into existing JSON at apply-time).
   */
  jsonMerge?: Array<{
    path: string;
    patch: unknown;
    createIfMissing?: boolean;
  }>;
  explanation?: string;
};

export type PreflightCheckResult = {
  id: string;
  title: string;
  status: PreflightStatus;
  severity: PreflightSeverity;
  message?: string;
  details?: string[];
  tags?: string[];
  /** optional auto-fix */
  fix?: {
    label?: string;
    patch: PreflightPatch;
  };
};

export type PreflightCheckFn = (
  files: ProjectFile[],
  target: PreflightTarget,
) => PreflightCheckResult;

export type PreflightCheck = {
  id: string;
  title: string;
  severity: PreflightSeverity;
  description?: string;
  run: PreflightCheckFn;
};

export type PreflightStage = {
  priority: PreflightSeverity;
  checks: PreflightCheck[];
};

export type PreflightRunUpdate = {
  stage: PreflightSeverity;
  results: PreflightCheckResult[];
};
