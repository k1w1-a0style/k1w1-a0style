import type { PreflightPatch } from "../../../lib/diagnostics/preflightTypes";
import type { FixStep } from "../types";

export type RunFixStep = (
  params: {
    index: number;
    run: () => Promise<void>;
    failMessage: string;
  },
) => Promise<unknown | null>;

export type FinishWithResult = (params: {
  status:
    | "advisory_only"
    | "patch_applicable"
    | "patch_applied"
    | "workflow_dispatched"
    | "blocked"
    | "failed"
    | "pending_recheck";
  detail?: string;
  localChangeApplied?: boolean;
  workflowTriggered?: boolean;
  partial?: boolean;
  stepIndex?: number;
}) => unknown;

export type OpenFixModal = (params: {
  title: string;
  subtitle: string;
  steps: FixStep[];
}) => void;

export type SharedFlowDeps = {
  rerunAfterFix: boolean;
  runFixStep: RunFixStep;
  finishWithResult: FinishWithResult;
  openFixModal: OpenFixModal;
  runDiagnostics: () => Promise<void>;
};

export type PatchDeps = {
  applyPatch: (label: string, patch: PreflightPatch) => Promise<unknown>;
  shouldSyncPatch: (patch: PreflightPatch) => boolean;
  syncPatchToGitHub: (label: string, patch: PreflightPatch) => Promise<void>;
};
