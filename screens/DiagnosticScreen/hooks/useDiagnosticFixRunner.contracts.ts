import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { ProjectData, ProjectFile } from "../../../shared/types/project";
import type { PreflightCheckResult, PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import type { FixHistoryEntry } from "../types";

export type ToastLike = { show: (msg: string) => void };

export interface UseDiagnosticFixRunnerOptions {
  projectRef: MutableRefObject<ProjectData | null>;
  mountedRef: MutableRefObject<boolean>;
  linkedRepo: string;
  linkedBranch?: string;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  syncFixesToGitHub: boolean;
  rerunAfterFix: boolean;
  autoFixIncludeWarn: boolean;
  autoFixScope: "visible" | "all";
  sortedResults: PreflightCheckResult[];
  visibleResults: PreflightCheckResult[];
  fixableResults: PreflightCheckResult[];
  selected: Record<string, boolean>;
  setSelected: Dispatch<SetStateAction<Record<string, boolean>>>;
  runDiagnostics: (opts?: { resetSelection?: boolean; resetHistory?: boolean }) => Promise<void>;
  toast?: ToastLike;
  clearHistoryRef?: MutableRefObject<null | (() => void)>;
}

export interface FixPreviewEntry {
  path: string;
  oldText: string | null;
  newText: string | null;
}

export interface UseDiagnosticFixRunnerState {
  history: FixHistoryEntry[];
  setHistory: Dispatch<SetStateAction<FixHistoryEntry[]>>;
  previewVisible: boolean;
  setPreviewVisible: Dispatch<SetStateAction<boolean>>;
  previewLabel: string;
  setPreviewLabel: Dispatch<SetStateAction<string>>;
  previewEntries: FixPreviewEntry[];
  setPreviewEntries: Dispatch<SetStateAction<FixPreviewEntry[]>>;
  applyBusy: boolean;
  setApplyBusy: Dispatch<SetStateAction<boolean>>;
  applyBusyRef: MutableRefObject<boolean>;
}

export interface ApplyPatchResult {
  status: "blocked" | "failed" | "patch_applied";
  localChangeApplied: boolean;
  partial: boolean;
}

export type ApplyPatchFn = (label: string, patch: PreflightPatch) => Promise<ApplyPatchResult | undefined>;
