import AsyncStorage from "@react-native-async-storage/async-storage";

import { getBranchHeadSha } from "../infra/github/githubService";
import {
  CI_LITE_PERSISTENCE_REASONS,
  readPersistedCiLiteSelection,
  type CiLitePersistenceReason,
  type PersistedCiLiteSnapshot,
} from "./ciLitePersistence";
import {
  BUILD_READINESS_REASON_CODES,
  formatBuildReadinessFailure,
  getBuildReadinessMessage,
  type BuildReadinessReasonCode,
} from "./errors/buildReadinessErrors";
import { diagnosticLastOkKeyForSelection } from "./storageKeys";
import type { ProjectData } from "../shared/types/project";

export type BuildReadinessDeps = {
  storageGetItem?: (key: string) => Promise<string | null>;
  storageSetItem?: (key: string, value: string) => Promise<void>;
  getBranchHeadSha?: (owner: string, repo: string, branch: string) => Promise<string>;
};

export type BuildReadinessContext = {
  linkedRepo: string;
  linkedBranch: string;
  diagnosticOk: boolean;
};

export type BuildReadinessOkResult = {
  ok: true;
  reasonCode: null;
  message: null;
  snapshot: PersistedCiLiteSnapshot;
  context: BuildReadinessContext;
};

export type BuildReadinessBlockedResult = {
  ok: false;
  reasonCode: BuildReadinessReasonCode;
  message: string;
  snapshot: PersistedCiLiteSnapshot | null;
  context: BuildReadinessContext;
};

export type BuildReadinessResult = BuildReadinessOkResult | BuildReadinessBlockedResult;

function createBlockedResult(params: {
  reasonCode: BuildReadinessReasonCode;
  snapshot?: PersistedCiLiteSnapshot | null;
  context: BuildReadinessContext;
}): BuildReadinessBlockedResult {
  return {
    ok: false,
    reasonCode: params.reasonCode,
    message: getBuildReadinessMessage(params.reasonCode).trim(),
    snapshot: params.snapshot ?? null,
    context: params.context,
  };
}

function isValidRepoFullName(repoFullName: string): boolean {
  const normalized = String(repoFullName ?? "").trim();
  const parts = normalized.split("/");
  return parts.length === 2 && Boolean(parts[0]?.trim()) && Boolean(parts[1]?.trim());
}

const CI_LITE_REASON_TO_BUILD_READINESS_CODE: Partial<
  Record<(typeof CI_LITE_PERSISTENCE_REASONS)[keyof typeof CI_LITE_PERSISTENCE_REASONS], BuildReadinessReasonCode>
> = {
  [CI_LITE_PERSISTENCE_REASONS.PERSISTENCE_MISSING]: BUILD_READINESS_REASON_CODES.CI_LITE_MISSING,
  [CI_LITE_PERSISTENCE_REASONS.REPO_MISMATCH]: BUILD_READINESS_REASON_CODES.CI_LITE_REPO_MISMATCH,
  [CI_LITE_PERSISTENCE_REASONS.BRANCH_MISMATCH]: BUILD_READINESS_REASON_CODES.CI_LITE_BRANCH_MISMATCH,
  [CI_LITE_PERSISTENCE_REASONS.INVALID_SHA]: BUILD_READINESS_REASON_CODES.CI_LITE_INVALID_SHA,
  [CI_LITE_PERSISTENCE_REASONS.SHA_MISMATCH]: BUILD_READINESS_REASON_CODES.CI_LITE_SHA_MISMATCH,
  [CI_LITE_PERSISTENCE_REASONS.NOT_GREEN]: BUILD_READINESS_REASON_CODES.CI_LITE_NOT_GREEN,
  [CI_LITE_PERSISTENCE_REASONS.HEAD_UNVERIFIED]: BUILD_READINESS_REASON_CODES.CI_LITE_HEAD_UNVERIFIED,
};

const CI_LITE_INVALID_SNAPSHOT_REASONS: readonly CiLitePersistenceReason[] = [
  CI_LITE_PERSISTENCE_REASONS.INVALID_TIMESTAMP,
  CI_LITE_PERSISTENCE_REASONS.WORKFLOW_MISMATCH,
  CI_LITE_PERSISTENCE_REASONS.LINT_TYPECHECK_UNCLEAR,
];

function mapCiLiteReasonToCode(
  reason: CiLitePersistenceReason | null,
  stale: boolean,
): BuildReadinessReasonCode {
  if (stale || reason === CI_LITE_PERSISTENCE_REASONS.STALE) {
    return BUILD_READINESS_REASON_CODES.CI_LITE_STALE;
  }
  if (!reason) {
    return BUILD_READINESS_REASON_CODES.CI_LITE_MISSING;
  }
  const mappedCode = CI_LITE_REASON_TO_BUILD_READINESS_CODE[reason];
  if (mappedCode) {
    return mappedCode;
  }
  if (CI_LITE_INVALID_SNAPSHOT_REASONS.includes(reason)) {
    return BUILD_READINESS_REASON_CODES.CI_LITE_INVALID_SNAPSHOT;
  }
  return BUILD_READINESS_REASON_CODES.CI_LITE_MISSING;
}

export async function evaluateBuildReadiness(
  project: ProjectData,
  deps: BuildReadinessDeps = {},
): Promise<BuildReadinessResult> {
  const storageGetItem = deps.storageGetItem ?? ((key: string) => AsyncStorage.getItem(key));
  const readBranchHeadSha = deps.getBranchHeadSha ?? getBranchHeadSha;
  const linkedRepo = typeof project?.linkedRepo === "string" ? project.linkedRepo.trim() : "";
  const linkedBranch = typeof project?.linkedBranch === "string" ? project.linkedBranch.trim() : "";

  const baseContext: BuildReadinessContext = {
    linkedRepo,
    linkedBranch,
    diagnosticOk: false,
  };

  if (!isValidRepoFullName(linkedRepo)) {
    return createBlockedResult({
      reasonCode: BUILD_READINESS_REASON_CODES.INVALID_REPO,
      context: baseContext,
    });
  }

  if (!linkedBranch) {
    return createBlockedResult({
      reasonCode: BUILD_READINESS_REASON_CODES.MISSING_BRANCH,
      context: baseContext,
    });
  }

  const scopedDiagnosticKey = diagnosticLastOkKeyForSelection({
    linkedRepo,
    linkedBranch,
  });

  const diagScopedVal = await storageGetItem(scopedDiagnosticKey).catch(() => null);

  const diagnosticOk = diagScopedVal === "true";
  const context: BuildReadinessContext = {
    ...baseContext,
    diagnosticOk,
  };

  if (!diagnosticOk) {
    return createBlockedResult({
      reasonCode: BUILD_READINESS_REASON_CODES.DIAGNOSTIC_NOT_GREEN,
      context,
    });
  }

  const persistedCiLite = await readPersistedCiLiteSelection({
    repoFullName: linkedRepo,
    branchName: linkedBranch,
    requireGreen: true,
    deps: {
      storageGetItem,
      readBranchHeadSha,
    },
  });

  if (!persistedCiLite.snapshot) {
    const reasonCode = mapCiLiteReasonToCode(persistedCiLite.reason, persistedCiLite.stale);
    return createBlockedResult({
      reasonCode,
      context,
    });
  }

  return {
    ok: true,
    reasonCode: null,
    message: null,
    snapshot: persistedCiLite.snapshot,
    context,
  };
}

export async function assertBuildReadiness(
  project: ProjectData,
  deps: BuildReadinessDeps = {},
): Promise<BuildReadinessOkResult> {
  const result = await evaluateBuildReadiness(project, deps);
  if (!result.ok) {
    throw new Error(
      formatBuildReadinessFailure({
        reasonCode: result.reasonCode,
        message: result.message,
      }),
    );
  }
  return result;
}
