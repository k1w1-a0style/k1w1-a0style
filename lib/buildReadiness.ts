import AsyncStorage from "@react-native-async-storage/async-storage";

import { getBranchHeadSha } from "../infra/github/githubService";
import {
  readPersistedCiLiteSelection,
  type PersistedCiLiteSnapshot,
} from "./ciLitePersistence";
import {
  BUILD_READINESS_REASON_CODES,
  BUILD_READINESS_REASON_MESSAGES,
  formatBuildReadinessFailure,
  type BuildReadinessReasonCode,
} from "./errors/buildReadinessErrors";
import {
  STORAGE_KEYS,
  diagnosticLastOkKeyForSelection,
} from "./storageKeys";
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
  message?: string | null;
  snapshot?: PersistedCiLiteSnapshot | null;
  context: BuildReadinessContext;
}): BuildReadinessBlockedResult {
  const fallbackMessage = BUILD_READINESS_REASON_MESSAGES[params.reasonCode];
  return {
    ok: false,
    reasonCode: params.reasonCode,
    message: (params.message ?? fallbackMessage).trim(),
    snapshot: params.snapshot ?? null,
    context: params.context,
  };
}

function isValidRepoFullName(repoFullName: string): boolean {
  const normalized = String(repoFullName ?? "").trim();
  const parts = normalized.split("/");
  return parts.length === 2 && Boolean(parts[0]?.trim()) && Boolean(parts[1]?.trim());
}

function mapCiLiteReasonToCode(reason: string | null, stale: boolean): BuildReadinessReasonCode {
  if (stale || reason === "CI-Lite ist veraltet") {
    return BUILD_READINESS_REASON_CODES.CI_LITE_STALE;
  }
  if (!reason || reason === "CI-Lite-Persistenz fehlt oder ist unvollständig") {
    return BUILD_READINESS_REASON_CODES.CI_LITE_MISSING;
  }
  if (reason === "CI-Lite gehoert zu anderem Repo") {
    return BUILD_READINESS_REASON_CODES.CI_LITE_REPO_MISMATCH;
  }
  if (reason === "CI-Lite gehoert zu anderem Branch") {
    return BUILD_READINESS_REASON_CODES.CI_LITE_BRANCH_MISMATCH;
  }
  if (reason === "CI-Lite-SHA fehlt oder ist ungueltig") {
    return BUILD_READINESS_REASON_CODES.CI_LITE_INVALID_SHA;
  }
  if (reason.includes("SHA-Mismatch")) {
    return BUILD_READINESS_REASON_CODES.CI_LITE_SHA_MISMATCH;
  }
  if (reason === "CI-Lite Lint/Typecheck nicht gruen") {
    return BUILD_READINESS_REASON_CODES.CI_LITE_NOT_GREEN;
  }
  if (reason === "Branch-HEAD-SHA konnte nicht verifiziert werden") {
    return BUILD_READINESS_REASON_CODES.CI_LITE_HEAD_UNVERIFIED;
  }
  if (
    reason === "CI-Lite-Zeitstempel fehlt oder ist ungueltig" ||
    reason === "CI-Lite-Workflow passt nicht zur Persistenz" ||
    reason === "CI-Lite Lint/Typecheck unklar"
  ) {
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

  const [diagScopedVal, diagLegacyVal] = await Promise.all([
    storageGetItem(scopedDiagnosticKey).catch(() => null),
    storageGetItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null),
  ]);

  const diagnosticOk = (diagScopedVal ?? diagLegacyVal) === "true";
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
      message: persistedCiLite.reason,
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
