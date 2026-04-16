import { useCallback, useMemo } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { PreflightCheckResult } from "../../../lib/diagnostics/preflightTypes";
import { getDiagnosticFixOffer } from "../../../lib/diagnostics/fixResultContract";
import type { Status } from "../types";
import { useDiagnosticFixRunner } from "./useDiagnosticFixRunner";

export function useDiagnosticActions(params: {
  projectRef: MutableRefObject<import("../../../shared/types/project").ProjectData | null>;
  mountedRef: MutableRefObject<boolean>;
  linkedRepo: string;
  linkedBranch?: string;
  replaceProjectFiles: (files: import("../../../shared/types/project").ProjectFile[]) => Promise<void>;
  syncFixesToGitHub: boolean;
  rerunAfterFix: boolean;
  autoFixIncludeWarn: boolean;
  autoFixScope: "all" | "visible";
  sortedResults: PreflightCheckResult[];
  visibleResults: PreflightCheckResult[];
  fixableResults: PreflightCheckResult[];
  selected: Record<string, boolean>;
  setSelected: Dispatch<SetStateAction<Record<string, boolean>>>;
  runDiagnostics: (opts?: { resetSelection?: boolean; resetHistory?: boolean }) => Promise<void>;
  toast: { show: (msg: string, ttlMs?: number) => void };
  clearHistoryRef: MutableRefObject<null | (() => void)>;
  activeIssue: PreflightCheckResult | null;
  setActiveIssue: (issue: PreflightCheckResult | null) => void;
  setIssueSheetVisible: (visible: boolean) => void;
  toSeverity: (status: Status) => import("../../../components/diagnostics/IssueDetailSheet").IssueDetail["severity"];
}) {
  const {
    projectRef,
    mountedRef,
    linkedRepo,
    linkedBranch,
    replaceProjectFiles,
    syncFixesToGitHub,
    rerunAfterFix,
    autoFixIncludeWarn,
    autoFixScope,
    sortedResults,
    visibleResults,
    fixableResults,
    selected,
    setSelected,
    runDiagnostics,
    toast,
    clearHistoryRef,
    activeIssue,
    setActiveIssue,
    setIssueSheetVisible,
    toSeverity,
  } = params;

  const fixRunner = useDiagnosticFixRunner({
    projectRef,
    mountedRef,
    linkedRepo,
    linkedBranch,
    replaceProjectFiles,
    syncFixesToGitHub,
    rerunAfterFix,
    autoFixIncludeWarn,
    autoFixScope,
    sortedResults,
    visibleResults,
    fixableResults,
    selected,
    setSelected,
    runDiagnostics,
    toast,
    clearHistoryRef,
  });

  const openIssue = useCallback(
    (r: PreflightCheckResult) => {
      setActiveIssue(r);
      setIssueSheetVisible(true);
    },
    [setActiveIssue, setIssueSheetVisible],
  );

  const closeIssue = useCallback(() => setIssueSheetVisible(false), [setIssueSheetVisible]);

  const activeIssueDetail = useMemo(() => {
    if (!activeIssue) return null;
    const st = ((activeIssue.status ?? "pass") as Status) ?? "pass";
    const fixOffer = getDiagnosticFixOffer(activeIssue);
    return {
      title: activeIssue.title,
      message: activeIssue.message,
      details: activeIssue.details,
      severity: toSeverity(st),
      hasFix: fixOffer.status !== "advisory_only",
      fixLabel: activeIssue.fix?.label || fixOffer.actionLabel,
      previewAvailable: fixOffer.previewAvailable,
    };
  }, [activeIssue, toSeverity]);

  const { setSelected: _setSelected, ...fixRunnerPublic } = fixRunner;

  return {
    ...fixRunnerPublic,
    openIssue,
    closeIssue,
    activeIssueDetail,
  };
}
