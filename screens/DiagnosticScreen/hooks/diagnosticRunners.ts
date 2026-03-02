// screens/DiagnosticScreen/hooks/diagnosticRunners.ts
// Extracted from useDiagnosticScreen.ts: standalone async check runners.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Alert, LayoutAnimation, Platform, UIManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../../lib/storageKeys";


import type { BuildMode } from "../../../components/diagnostics/ModeSelector";
import type { TabKey } from "../../../components/diagnostics/SegmentedTabs";

import type { PreflightCheckResult, PreflightTarget } from "../../../lib/diagnostics/preflightTypes";
import { runPreflightChecksProgressive } from "../../../lib/diagnostics/preflightRunner";
import { runBuildPipelineDiagnostics } from "../../../lib/diagnostics/buildPipelineDiagnostics";
import { parseOwnerRepo } from "../../../lib/diagnostics/ciAutoFix";

import { useDiagnosticCiAutofix } from "./useDiagnosticCiAutofix";

import { useInlineToast } from "../../../components/diagnostics/useInlineToast";
import type { IssueDetail } from "../../../components/diagnostics/IssueDetailSheet";

import { useDiagnosticPreferences } from "./useDiagnosticPreferences";
import { useDiagnosticUpload } from "./useDiagnosticUpload";
import { useDiagnosticFixRunner } from "./useDiagnosticFixRunner";
import { useDiagnosticSelection } from "./useDiagnosticSelection";
import { useDiagnosticIssueFiltering } from "./useDiagnosticIssueFiltering";

import type { ProjectData } from "../../../shared/types/project";

import type { Status } from "../types";
export const ORDER: Record<Status, number> = { fail: 0, warn: 1, pass: 2 };

export async function runLocalChecks(params: {
  includeLocalChecks: boolean;
  focusedProfiles: Array<"development" | "preview" | "production">;
  files: any;
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
    for await (const stage of prog as any) {
      if (!mountedRef.current) break;

      if (stage?.priority) {
        if (mountedRef.current) {
          setProgressStage(`Checks: local/${t.profile} • ${String(stage.priority)}`);
        }
      }

      if (stage?.results?.length) {
        const decorated = (stage.results as PreflightCheckResult[]).map((r) => ({
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
    pipelineAppliesToFocus,
    all,
    mountedRef,
    setResults,
    setProgressStage,
  } = params;

  const parsed = includePipelineChecks ? parseOwnerRepo(linkedRepo) : null;
  if (!parsed) return;

  try {
    if (!mountedRef.current) return;
    if (mountedRef.current) setProgressStage("Checks: pipeline (GitHub/EAS)…");

    const { checks } = await runBuildPipelineDiagnostics({
      owner: parsed.owner,
      repo: parsed.repo,
      branch: (linkedBranch || "main").trim(),
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
  } catch (e: any) {
    if (!mountedRef.current) return;

    all.push({
      id: "pipeline::error",
      title: "Pipeline Diagnostics",
      severity: "high",
      status: "fail",
      message: e?.message || "Pipeline Diagnostics fehlgeschlagen",
    });
    if (mountedRef.current) setResults([...all]);
  }
}

