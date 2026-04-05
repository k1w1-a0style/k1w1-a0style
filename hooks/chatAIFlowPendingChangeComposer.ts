import type { OrchestratorResult } from "../lib/orchestrator";
import type { ApplyFilesResult } from "../lib/fileWriter";
import { applyFilesToProject } from "../lib/fileWriter";
import { buildProjectStateDigest } from "../lib/chatFlowStateGuards";
import { buildChangePreviews } from "../lib/changePreview";
import type { PendingChange } from "./chatAIFlowTypes";
import { buildAiProposalSummary } from "./chatAIFlowSummaryHelpers";

export type BuildPathBulletList = (paths: string[], previewLimit: number) => string;

export type ComposePendingChangeArgs = {
  isAutoFix: boolean;
  currentProjectFiles: PendingChange["files"];
  finalFiles: PendingChange["files"];
  proposedFiles: PendingChange["files"];
  aiResponse: OrchestratorResult;
  agentResponse: OrchestratorResult | null;
  finalFileSource: PendingChange["finalFileSource"];
  validatorState: PendingChange["validatorState"];
  sourceSummary: string;
  explainText: string;
  preflightIntro: string;
  buildPathBulletList: BuildPathBulletList;
};

export type ComposedPendingChange = {
  pendingChange: PendingChange;
  mergeResult: ApplyFilesResult;
  summaryText: string;
};

export const computeMergeResult = (
  currentProjectFiles: PendingChange["files"],
  finalFiles: PendingChange["files"],
): ApplyFilesResult => applyFilesToProject(currentProjectFiles, finalFiles);

export const composePendingChange = ({
  isAutoFix,
  currentProjectFiles,
  finalFiles,
  proposedFiles,
  aiResponse,
  agentResponse,
  finalFileSource,
  validatorState,
  sourceSummary,
  explainText,
  preflightIntro,
  buildPathBulletList,
}: ComposePendingChangeArgs): ComposedPendingChange => {
  const baseProjectDigest = buildProjectStateDigest(currentProjectFiles);
  const mergeResult = computeMergeResult(currentProjectFiles, finalFiles);
  const changePreviews = buildChangePreviews({
    baseFiles: currentProjectFiles,
    finalFiles: mergeResult.files,
    created: mergeResult.created,
    updated: mergeResult.updated,
  });

  const summaryText = buildAiProposalSummary({
    isAutoFix,
    sourceSummary,
    explainText,
    preflightIntro,
    created: mergeResult.created,
    updated: mergeResult.updated,
    skipped: mergeResult.skipped,
    errors: mergeResult.errors,
    buildPathBulletList,
  });

  return {
    mergeResult,
    summaryText,
    pendingChange: {
      files: mergeResult.files,
      proposedFiles,
      baseProjectDigest,
      summary: summaryText,
      created: mergeResult.created,
      updated: mergeResult.updated,
      skipped: mergeResult.skipped,
      errors: mergeResult.errors,
      aiResponse,
      agentResponse: agentResponse ?? undefined,
      changePreviews,
      finalFileSource,
      validatorState,
      sourceSummary,
    },
  };
};
