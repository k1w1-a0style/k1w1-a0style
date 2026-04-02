// screens/DiagnosticScreen/hooks/diagnosticRunners.ts
// Extracted from useDiagnosticScreen.ts: standalone async check runners.

import type { MutableRefObject } from "react";
import type { ProjectFile } from "../../../shared/types/project";
import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";
import { runPreflightChecksProgressive } from "../../../lib/diagnostics/preflightRunner";
import { runBuildPipelineDiagnostics } from "../../../lib/diagnostics/buildPipelineDiagnostics";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";
import { getRepoSyncState } from "../../../lib/repoSyncOrchestration";
import { getDiagnosticUiErrorMessage } from "./diagnosticErrorHelpers";

import type { Status } from "../types";
export const ORDER: Record<Status, number> = { fail: 0, warn: 1, pass: 2 };

export async function runLocalChecks(params: {
  includeLocalChecks: boolean;
  focusedProfiles: Array<"development" | "preview" | "production">;
  files: ProjectFile[];
  all: PreflightCheckResult[];
  mountedRef: MutableRefObject<boolean>;
  setResults: (v: PreflightCheckResult[]) => void;
  setProgressStage: (v: string | null) => void;
}) {
  const {
    includeLocalChecks,
    focusedProfiles,
    files,
    all,
    mountedRef,
    setResults,
    setProgressStage,
  } = params;

  if (!includeLocalChecks) return;

  // Throttle progressive updates: avoids excessive re-renders on large projects.
  let lastUpdateMs = 0;
  const MIN_UPDATE_INTERVAL_MS = 300;

  const maybeSetResults = () => {
    const now = Date.now();
    if (now - lastUpdateMs < MIN_UPDATE_INTERVAL_MS) return;
    lastUpdateMs = now;
    if (mountedRef.current) setResults([...all]);
  };

  for (const prof of focusedProfiles) {
    if (!mountedRef.current) break;

    const t = { mode: "eas" as const, profile: prof };

    if (mountedRef.current) {
      setProgressStage(`Checks: local/${t.profile}`);
    }

    const prog = runPreflightChecksProgressive(files, t);
    for await (const stage of prog) {
      if (!mountedRef.current) break;

      if (stage?.stage) {
        if (mountedRef.current) {
          setProgressStage(`Checks: local/${t.profile} • ${String(stage.stage)}`);
        }
      }

      if (stage?.results?.length) {
        const decorated = stage.results.map((r) => ({
          ...r,
          id: `${t.profile}::${r.id}`,
          title: `${r.title} (${t.profile})`,
        }));
        all.push(...decorated);
        maybeSetResults();
      }
    }
  }

  // Final update (ensures last chunk is shown).
  if (mountedRef.current) setResults([...all]);
}


export async function runPipelineChecks(params: {
  includePipelineChecks: boolean;
  linkedRepo: string;
  linkedBranch?: string;
  files: ProjectFile[];
  pipelineAppliesToFocus: (id: string) => boolean;
  all: PreflightCheckResult[];
  mountedRef: MutableRefObject<boolean>;
  setResults: (v: PreflightCheckResult[]) => void;
  setProgressStage: (v: string | null) => void;
}) {
  const {
    includePipelineChecks,
    linkedRepo,
    linkedBranch,
    files,
    pipelineAppliesToFocus,
    all,
    mountedRef,
    setResults,
    setProgressStage,
  } = params;

  const parsed = includePipelineChecks ? parseOwnerRepo(linkedRepo) : null;
  if (!parsed) return;
  const branch = (linkedBranch || "").trim();
  if (!branch) return;

  const syncState = await getRepoSyncState({
    linkedRepo,
    linkedBranch: branch,
    files,
  });
  if (syncState !== "in_sync") {
    all.push({
      id: "pipeline::repoSyncRequired",
      title: "Pipeline Diagnostics",
      severity: "high",
      status: "fail",
      message:
        syncState === "out_of_sync"
          ? "Pipeline-Checks blockiert: Lokale Änderungen sind noch nicht zum gewählten Repo/Branch gepusht."
          : "Pipeline-Checks blockiert: Sync-Status lokal↔Repo ist unklar. Bitte zuerst explizit pushen.",
    });
    if (mountedRef.current) setResults([...all]);
    return;
  }

  try {
    if (!mountedRef.current) return;
    if (mountedRef.current) setProgressStage("Checks: pipeline (GitHub/EAS)…");

    const { checks } = await runBuildPipelineDiagnostics({
      owner: parsed.owner,
      repo: parsed.repo,
      branch,
    });

    if (!mountedRef.current) return;

    const pipelineResults: PreflightCheckResult[] = checks
      .filter((c) => pipelineAppliesToFocus(c.id))
      .map((c) => ({
        id: `pipeline::${c.id}`,
        title: c.title,
        severity: c.status === "fail" ? "high" : "normal",
        status:
          c.status === "fail"
            ? "fail"
            : c.status === "warn"
              ? "warn"
              : "pass",
        message: c.fixHint || c.details,
        details: c.fixHint && c.details ? [c.details] : undefined,
        fix: c.fix
          ? {
              label: c.fix.label,
              patch: c.fix.patch,
              workflowDispatch: c.fix.workflowDispatch,
            }
          : undefined,
      }));

    all.push(...pipelineResults);
    if (mountedRef.current) setResults([...all]);
  } catch (e: unknown) {
    if (!mountedRef.current) return;

    all.push({
      id: "pipeline::error",
      title: "Pipeline Diagnostics",
      severity: "high",
      status: "fail",
      message: getDiagnosticUiErrorMessage(e, "Pipeline Diagnostics fehlgeschlagen"),
    });
    if (mountedRef.current) setResults([...all]);
  }
}
