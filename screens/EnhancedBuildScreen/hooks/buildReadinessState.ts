import AsyncStorage from "@react-native-async-storage/async-storage";

import { getBranchHeadSha } from "../../../infra/github/githubService";
import {
  STORAGE_KEYS,
  diagnosticLastOkKeyForSelection,
} from "../../../lib/storageKeys";

type BuildReadinessStateDeps = {
  storageGetItem?: (key: string) => Promise<string | null>;
  readBranchHeadSha?: (owner: string, repo: string, branch: string) => Promise<string>;
};

export type BuildReadinessState = {
  hasDiagOk: boolean;
  hasCiLiteOk: boolean;
  ciLiteReason: string | null;
  ciLiteStale: boolean;
};

const CI_LITE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const SHA_RE = /^[0-9a-f]{40}$/i;

function normalizeRepoParts(repoFullName: string): { owner: string; repo: string } | null {
  const normalized = String(repoFullName ?? "").trim();
  const parts = normalized.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return {
    owner: parts[0].trim(),
    repo: parts[1].trim(),
  };
}

export async function readBuildReadinessState(params: {
  repoFullName: string;
  branchName: string;
  deps?: BuildReadinessStateDeps;
}): Promise<BuildReadinessState> {
  const { repoFullName, branchName, deps } = params;
  const storageGetItem = deps?.storageGetItem ?? ((key: string) => AsyncStorage.getItem(key));
  const readBranchHeadSha = deps?.readBranchHeadSha ?? getBranchHeadSha;

  const scopedDiagnosticKey = diagnosticLastOkKeyForSelection({
    linkedRepo: repoFullName,
    linkedBranch: branchName,
  });

  const [diagScopedVal, diagLegacyVal, lintOk, typeOk, lastRepo, lastBranch, lastRunAt, lastSha] =
    await Promise.all([
      storageGetItem(scopedDiagnosticKey).catch(() => null),
      storageGetItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null),
      storageGetItem(STORAGE_KEYS.CI_LITE_LINT_OK).catch(() => null),
      storageGetItem(STORAGE_KEYS.CI_LITE_TYPECHECK_OK).catch(() => null),
      storageGetItem(STORAGE_KEYS.CI_LITE_LAST_REPO).catch(() => null),
      storageGetItem(STORAGE_KEYS.CI_LITE_LAST_BRANCH).catch(() => null),
      storageGetItem(STORAGE_KEYS.CI_LITE_LAST_RUN_AT).catch(() => null),
      storageGetItem(STORAGE_KEYS.CI_LITE_LAST_SHA).catch(() => null),
    ]);

  const diagVal = diagScopedVal ?? diagLegacyVal;
  const repoMatches = (lastRepo ?? "").trim() === (repoFullName ?? "").trim();
  const branchMatches = (lastBranch ?? "").trim() === (branchName ?? "").trim();
  const runTs = Number(lastRunAt ?? "");
  const stale = !Number.isFinite(runTs) || runTs <= 0 || Date.now() - runTs > CI_LITE_MAX_AGE_MS;

  let reason: string | null = null;
  if (diagVal !== "true") {
    reason = "Diagnostik nicht gruen";
  } else if (lintOk !== "true" || typeOk !== "true") {
    reason = "CI-Lite Lint/Typecheck nicht gruen";
  } else if (!repoMatches) {
    reason = "CI-Lite gehoert zu anderem Repo";
  } else if (!branchMatches) {
    reason = "CI-Lite gehoert zu anderem Branch";
  } else if (stale) {
    reason = "CI-Lite ist veraltet";
  } else if (!SHA_RE.test(String(lastSha ?? "").trim())) {
    reason = "CI-Lite-SHA fehlt oder ist ungueltig";
  } else {
    const repoParts = normalizeRepoParts(repoFullName);
    const branch = String(branchName ?? "").trim();
    if (!repoParts || !branch) {
      reason = "Repo oder Branch fehlen";
    } else {
      try {
        const currentHeadSha = await readBranchHeadSha(
          repoParts.owner,
          repoParts.repo,
          branch,
        );
        if (!SHA_RE.test(String(currentHeadSha ?? "").trim())) {
          reason = "Branch-HEAD-SHA konnte nicht verifiziert werden";
        } else if (
          String(lastSha).trim().toLowerCase() !== String(currentHeadSha).trim().toLowerCase()
        ) {
          reason = "Repo/Branch wurden seit dem letzten gruenen CI-Lite-Run geaendert (SHA-Mismatch)";
        }
      } catch {
        reason = "Branch-HEAD-SHA konnte nicht verifiziert werden";
      }
    }
  }

  return {
    hasDiagOk: diagVal === "true",
    hasCiLiteOk: reason === null,
    ciLiteReason: reason,
    ciLiteStale: stale,
  };
}
