import type { MutableRefObject } from "react";
import type { BuildMode } from "../../../components/diagnostics/ModeSelector";
import type { TabKey } from "../../../components/diagnostics/SegmentedTabs";
import type { IssueDetail } from "../../../components/diagnostics/IssueDetailSheet";
import type { PreflightCheckResult, PreflightTarget } from "../../../lib/diagnostics/preflightTypes";
import type { Status } from "../types";
import type { ProjectData, ProjectFile } from "../../../shared/types/project";

export type UseDiagnosticScreenOptions = {
  projectData: ProjectData | null;
  linkedRepo: string;
  linkedBranch?: string;
  setPreferredBuildProfile?: (mode: BuildMode) => void;
  replaceProjectFiles: (files: ProjectFile[]) => Promise<void>;
};

export type RunDiagnostics = (opts?: { resetSelection?: boolean; resetHistory?: boolean }) => Promise<void>;

export type DiagnosticUiState = {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  advancedOpen: boolean;
  advancedFixesOpen: boolean;
  toggleAdvanced: () => void;
  toggleAdvancedFixes: () => void;
  reportVisible: boolean;
  setReportVisible: (next: boolean) => void;
  issueSheetVisible: boolean;
  setIssueSheetVisible: (next: boolean) => void;
  activeIssue: PreflightCheckResult | null;
  setActiveIssue: (issue: PreflightCheckResult | null) => void;
};

export type DiagnosticResultsModel = {
  counts: { pass: number; warn: number; fail: number };
  sortedResults: PreflightCheckResult[];
  fixableResults: PreflightCheckResult[];
  issuesFilter: string;
  setIssuesFilter: (next: string) => void;
  visibleResults: PreflightCheckResult[];
  pipelineAppliesToFocus: (id: string) => boolean;
  toSeverity: (status: Status) => IssueDetail["severity"];
};

export type DiagnosticRunControllerParams = {
  projectRef: MutableRefObject<ProjectData | null>;
  mountedRef: MutableRefObject<boolean>;
  linkedRepo: string;
  linkedBranch?: string;
  includeLocalChecks: boolean;
  includePipelineChecks: boolean;
  modesAll: boolean;
  selectedModes: BuildMode[];
  recommendedMode: BuildMode;
  pipelineAppliesToFocus: (id: string) => boolean;
  clearSelection: () => void;
  clearHistoryRef: MutableRefObject<null | (() => void)>;
  onScopeInvalidated: () => void;
};
