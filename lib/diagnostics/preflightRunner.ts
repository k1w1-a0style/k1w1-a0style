// lib/diagnostics/preflightRunner.ts

import type { ProjectFile } from "../../shared/types/project";
import type {
  PreflightCheck,
  PreflightCheckResult,
  PreflightSeverity,
  PreflightTarget,
} from "./preflightTypes";
import { PREFLIGHT_CHECKS, PRECHECKS_REGISTRY } from "./preflightChecks";

const ORDER: PreflightSeverity[] = ["critical", "high", "normal", "low"];

export type ProgressiveUpdate = {
  stage: PreflightSeverity;
  results: PreflightCheckResult[];
  done: boolean;
};

function internalErrorResult(
  check: PreflightCheck,
  err: unknown,
): PreflightCheckResult {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Unbekannter Fehler";
  return {
    id: check.id,
    title: check.title,
    severity: check.severity,
    status: "fail",
    message: `Check crashed: ${msg}`,
    tags: ["internal-error"],
  };
}

/**
 * Runs all checks grouped by severity, streaming results after each stage.
 * Important: A single crashing check must NOT abort the whole run.
 */
export async function* runPreflightChecksProgressive(
  files: ProjectFile[],
  target: PreflightTarget,
  checks: ReadonlyArray<PreflightCheck> = PRECHECKS_REGISTRY,
): AsyncGenerator<ProgressiveUpdate, void, void> {
  for (const stage of ORDER) {
    const stageChecks = checks.filter((c) => c.severity === stage);
    const results: PreflightCheckResult[] = [];
    for (const check of stageChecks) {
      // keep UI responsive
      await new Promise((r) => setTimeout(r, 0));
      try {
        const res = check.run(files, target);
        results.push(res);
      } catch (e) {
        results.push(internalErrorResult(check, e));
      }
    }
    yield { stage, results, done: stage === ORDER[ORDER.length - 1] };
  }
}

export function runPreflightChecksAll(
  files: ProjectFile[],
  target: PreflightTarget,
  checks: ReadonlyArray<PreflightCheck> = PRECHECKS_REGISTRY,
): PreflightCheckResult[] {
  return checks.map((c) => {
    try {
      return c.run(files, target);
    } catch (e) {
      return internalErrorResult(c, e);
    }
  });
}


export const runPreflightChecks = runPreflightChecksAll;
