import type { OrchestratorResult } from "../lib/orchestrator";
import type { ApplyFilesResult } from "../lib/fileWriter";
import { applyFileOpsToProject } from "../lib/fileWriter";
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
  proposedDeletePaths?: string[];
  proposedRenames?: Array<{ from: string; to: string }>;
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
  ops?: {
    deletePaths?: string[];
    renames?: Array<{ from: string; to: string }>;
  },
): ApplyFilesResult => applyFileOpsToProject(currentProjectFiles, finalFiles, ops);

export const composePendingChange = ({
  isAutoFix,
  currentProjectFiles,
  finalFiles,
  proposedFiles,
  proposedDeletePaths,
  proposedRenames,
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
  const mergeResult = computeMergeResult(currentProjectFiles, finalFiles, {
    deletePaths: proposedDeletePaths,
    renames: proposedRenames,
  });
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
    deleted: mergeResult.deleted,
    renamed: mergeResult.renamed,
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
      proposedDeletePaths,
      proposedRenames,
      baseProjectDigest,
      summary: summaryText,
      created: mergeResult.created,
      updated: mergeResult.updated,
      skipped: mergeResult.skipped,
      deleted: mergeResult.deleted,
      renamed: mergeResult.renamed,
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
