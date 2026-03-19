import AsyncStorage from "@react-native-async-storage/async-storage";

import { getBranchHeadSha } from "../../../infra/github/githubService";
import { readPersistedCiLiteSelection } from "../../../lib/ciLitePersistence";
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

  const [diagScopedVal, diagLegacyVal, persistedCiLite] = await Promise.all([
    storageGetItem(scopedDiagnosticKey).catch(() => null),
    storageGetItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null),
    readPersistedCiLiteSelection({
      repoFullName,
      branchName,
      requireGreen: true,
      deps: {
        storageGetItem,
        readBranchHeadSha,
      },
    }),
  ]);

  const diagVal = diagScopedVal ?? diagLegacyVal;
  const reason = diagVal !== "true" ? "Diagnostik nicht gruen" : persistedCiLite.reason;

  return {
    hasDiagOk: diagVal === "true",
    hasCiLiteOk: reason === null,
    ciLiteReason: reason,
    ciLiteStale: persistedCiLite.stale,
  };
}
