import AsyncStorage from "@react-native-async-storage/async-storage";

import { getBranchHeadSha } from "../../../infra/github/githubService";
import { readPersistedCiLiteSelection } from "../../../lib/ciLitePersistence";
import {
  STORAGE_KEYS,
  diagnosticLastOkKeyForSelection,
} from "../../../lib/storageKeys";
import {
  normalizeVerificationContract,
  type VerificationContractState,
} from "../../../lib/status/verificationContract";

type BuildReadinessStateDeps = {
  storageGetItem?: (key: string) => Promise<string | null>;
  readBranchHeadSha?: (owner: string, repo: string, branch: string) => Promise<string>;
};

export type BuildReadinessState = {
  hasDiagOk: boolean;
  hasCiLiteOk: boolean;
  diagnosticState: VerificationContractState;
  diagnosticReason: string | null;
  ciLiteReason: string | null;
  ciLiteState: VerificationContractState;
  ciLiteStale: boolean;
};

export function describeReadinessContract(params: {
  area: "diagnostic" | "ci_lite";
  state: VerificationContractState;
  reason?: string | null;
}): string {
  if (params.reason) return params.reason;
  if (params.area === "diagnostic") {
    if (params.state === "verified") return "Letzter bekannter Diagnose-Check: OK";
    if (params.state === "stale") return "Diagnose ist nicht mehr frisch bestaetigt.";
    return "Diagnose wurde fuer dieses Repo/Branch noch nicht sicher bestaetigt.";
  }
  if (params.state === "verified") return "Letzter bekannter CI-Lite-Run: OK";
  if (params.state === "stale") return "CI-Lite ist veraltet und sollte neu laufen.";
  return "CI-Lite ist fuer dieses Repo/Branch derzeit nicht sicher bestaetigt.";
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
  const diagnosticContract = normalizeVerificationContract({
    explicitState: diagVal === "true" ? "verified" : "unknown",
  });
  const ciLiteContract = normalizeVerificationContract({
    explicitState: persistedCiLite.reason
      ? (persistedCiLite.stale ? "stale" : "unknown")
      : "verified",
  });
  const diagnosticReason = diagnosticContract.isVerified
    ? null
    : describeReadinessContract({
        area: "diagnostic",
        state: diagnosticContract.state,
      });
  const reason = ciLiteContract.isVerified
    ? null
    : describeReadinessContract({
        area: "ci_lite",
        state: ciLiteContract.state,
        reason: persistedCiLite.reason,
      });

  return {
    hasDiagOk: diagnosticContract.isVerified,
    hasCiLiteOk: ciLiteContract.isVerified,
    diagnosticState: diagnosticContract.state,
    diagnosticReason,
    ciLiteReason: reason,
    ciLiteState: ciLiteContract.state,
    ciLiteStale: persistedCiLite.stale,
  };
}
