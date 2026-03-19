import type { PreflightCheckResult } from "./preflightTypes";

export type DiagnosticFixStatus =
  | "advisory_only"
  | "patch_applicable"
  | "patch_applied"
  | "workflow_dispatched"
  | "blocked"
  | "failed"
  | "pending_recheck";

export type DiagnosticFixTone = "success" | "warning" | "info";

export type DiagnosticFixExecutionResult = {
  status: DiagnosticFixStatus;
  tone: DiagnosticFixTone;
  summary: string;
  detail?: string;
  requiresRecheck: boolean;
  localChangeApplied: boolean;
  workflowTriggered: boolean;
  partial: boolean;
};

export type DiagnosticFixOffer = {
  status: Extract<DiagnosticFixStatus, "advisory_only" | "patch_applicable" | "workflow_dispatched">;
  badgeText: string | null;
  actionLabel?: string;
  previewAvailable: boolean;
  summary: string;
};

export function getDiagnosticFixOffer(result: Pick<PreflightCheckResult, "fix" | "status">): DiagnosticFixOffer {
  const hasPatch = !!result.fix?.patch;
  const hasWorkflow = !!result.fix?.workflowDispatch;

  if (hasPatch) {
    return {
      status: "patch_applicable",
      badgeText: "Patch-Fix verfügbar",
      actionLabel: hasWorkflow ? "Patch + Workflow prüfen" : "Patch-Fix anwenden",
      previewAvailable: true,
      summary: hasWorkflow
        ? "Lokaler Patch-Fix verfügbar; danach kann optional ein Workflow gestartet werden."
        : "Lokaler Patch-Fix verfügbar.",
    };
  }

  if (hasWorkflow) {
    return {
      status: "workflow_dispatched",
      badgeText: "Workflow-Fix verfügbar",
      actionLabel: "Workflow-Fix starten",
      previewAvailable: false,
      summary: "Fix kann nur per Workflow/Remote-Aktion angestoßen werden und braucht danach einen Re-Check.",
    };
  }

  return {
    status: "advisory_only",
    badgeText: result.status !== "pass" ? "KI-Fix verfügbar" : null,
    actionLabel: undefined,
    previewAvailable: false,
    summary: result.status === "pass" ? "Kein Fix nötig." : "Nur Hinweis oder manueller/KI-Follow-up verfügbar.",
  };
}

export function getDiagnosticFixExecutionResult(params: {
  status: DiagnosticFixStatus;
  detail?: string;
  localChangeApplied?: boolean;
  workflowTriggered?: boolean;
  partial?: boolean;
}): DiagnosticFixExecutionResult {
  const localChangeApplied = !!params.localChangeApplied;
  const workflowTriggered = !!params.workflowTriggered;
  const partial = !!params.partial;

  switch (params.status) {
    case "patch_applied":
      return {
        status: "patch_applied",
        tone: "success",
        summary: "Patch lokal angewendet.",
        detail: params.detail,
        requiresRecheck: false,
        localChangeApplied: true,
        workflowTriggered,
        partial,
      };
    case "pending_recheck":
      return {
        status: "pending_recheck",
        tone: localChangeApplied ? "warning" : "info",
        summary: workflowTriggered
          ? "Fix angestoßen – Re-Check noch nötig."
          : "Patch angewendet – Re-Check noch nötig.",
        detail: params.detail,
        requiresRecheck: true,
        localChangeApplied,
        workflowTriggered,
        partial,
      };
    case "workflow_dispatched":
      return {
        status: "workflow_dispatched",
        tone: "info",
        summary: "Workflow-Fix gestartet.",
        detail: params.detail,
        requiresRecheck: true,
        localChangeApplied,
        workflowTriggered: true,
        partial,
      };
    case "blocked":
      return {
        status: "blocked",
        tone: "warning",
        summary: partial
          ? "Fix blockiert – Änderungen nur teilweise angewendet."
          : "Fix blockiert – nichts wurde als behoben markiert.",
        detail: params.detail,
        requiresRecheck: partial,
        localChangeApplied,
        workflowTriggered,
        partial,
      };
    case "failed":
      return {
        status: "failed",
        tone: "warning",
        summary: partial
          ? "Fix fehlgeschlagen – Änderungen nur teilweise angewendet."
          : "Fix fehlgeschlagen.",
        detail: params.detail,
        requiresRecheck: partial || workflowTriggered || localChangeApplied,
        localChangeApplied,
        workflowTriggered,
        partial,
      };
    case "patch_applicable":
      return {
        status: "patch_applicable",
        tone: "info",
        summary: "Patch-Fix ist verfügbar, wurde aber noch nicht angewendet.",
        detail: params.detail,
        requiresRecheck: false,
        localChangeApplied,
        workflowTriggered,
        partial,
      };
    case "advisory_only":
    default:
      return {
        status: "advisory_only",
        tone: "info",
        summary: "Nur Hinweis – kein anwendbarer Auto-Fix.",
        detail: params.detail,
        requiresRecheck: false,
        localChangeApplied: false,
        workflowTriggered: false,
        partial: false,
      };
  }
}

export class DiagnosticFixApplyError extends Error {
  status: Extract<DiagnosticFixStatus, "blocked" | "failed">;
  partial: boolean;
  localChangeApplied: boolean;
  workflowTriggered: boolean;

  constructor(params: {
    message: string;
    status: Extract<DiagnosticFixStatus, "blocked" | "failed">;
    partial?: boolean;
    localChangeApplied?: boolean;
    workflowTriggered?: boolean;
  }) {
    super(params.message);
    this.name = "DiagnosticFixApplyError";
    this.status = params.status;
    this.partial = !!params.partial;
    this.localChangeApplied = !!params.localChangeApplied;
    this.workflowTriggered = !!params.workflowTriggered;
  }
}
