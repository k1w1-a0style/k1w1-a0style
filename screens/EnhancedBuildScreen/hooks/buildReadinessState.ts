import AsyncStorage from "@react-native-async-storage/async-storage";

import { getBranchHeadSha } from "../../../infra/github/githubService";
import { readPersistedCiLiteSelection } from "../../../lib/ciLitePersistence";
import { readDiagnosticReadinessRecord } from "../../../lib/diagnosticReadinessRecord";
import { logger } from "../../../lib/logger";
import {
  ciLiteSnapshotKeyForSelection,
  diagnosticLastOkKeyForSelection,
  diagnosticReadinessRecordKeyForSelection,
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
  const asyncStorageGetItem =
    (AsyncStorage as { getItem?: ((key: string) => Promise<string | null>) | undefined }).getItem ??
    (
      AsyncStorage as {
        default?: { getItem?: ((key: string) => Promise<string | null>) | undefined } | undefined;
      }
    ).default?.getItem ??
    (
      AsyncStorage as {
        default?: {
          default?: { getItem?: ((key: string) => Promise<string | null>) | undefined } | undefined;
        } | undefined;
      }
    ).default?.default?.getItem;
  const storageGetItem =
    deps?.storageGetItem ??
    (asyncStorageGetItem ? ((key: string) => asyncStorageGetItem(key)) : async () => null);
  const readBranchHeadSha = deps?.readBranchHeadSha ?? getBranchHeadSha;

  const scopedDiagnosticKey = diagnosticLastOkKeyForSelection({
    linkedRepo: repoFullName,
    linkedBranch: branchName,
  });
  const scopedDiagnosticRecordKey = diagnosticReadinessRecordKeyForSelection({
    linkedRepo: repoFullName,
    linkedBranch: branchName,
  });
  const scopedCiLiteSnapshotKey = ciLiteSnapshotKeyForSelection({
    linkedRepo: repoFullName,
    linkedBranch: branchName,
  });
  const readErrorKeys = new Set<string>();
  const trackedStorageGetItem = async (key: string): Promise<string | null> => {
    try {
      return await storageGetItem(key);
    } catch (error: unknown) {
      readErrorKeys.add(key);
      throw error;
    }
  };

  const [diagRecord, diagScopedVal, persistedCiLite] = await Promise.all([
    readDiagnosticReadinessRecord({
      linkedRepo: repoFullName,
      linkedBranch: branchName,
      storageGetItem: trackedStorageGetItem,
    }).catch((error: unknown) => {
      logger.warn("[EnhancedBuild] structured diagnostic record read failed", {
        repoFullName,
        branchName,
        error,
      });
      return null;
    }),
    trackedStorageGetItem(scopedDiagnosticKey).catch((error: unknown) => {
      logger.warn("[EnhancedBuild] diagnostic storage read failed", { key: scopedDiagnosticKey, error });
      return null;
    }),
    readPersistedCiLiteSelection({
      repoFullName,
      branchName,
      requireGreen: true,
      deps: {
        storageGetItem: trackedStorageGetItem,
        readBranchHeadSha,
      },
    }),
  ]);

  const diagVal = diagRecord
    ? (diagRecord.diagnosticOk && diagRecord.includePipelineChecks ? "true" : "false")
    : diagScopedVal;
  const diagnosticContract = normalizeVerificationContract({
    explicitState: diagVal === "true" ? "verified" : "unknown",
  });
  const ciLiteContract = normalizeVerificationContract({
    explicitState: persistedCiLite.reason
      ? (persistedCiLite.stale ? "stale" : "unknown")
      : "verified",
  });
  const diagReadFailed =
    readErrorKeys.has(scopedDiagnosticKey) || readErrorKeys.has(scopedDiagnosticRecordKey);
  const ciLiteReadFailed = Array.from(readErrorKeys).some((key) => key === scopedCiLiteSnapshotKey || key.startsWith("ci_lite_"));
  const diagnosticReason = diagnosticContract.isVerified
    ? null
    : diagRecord && !diagRecord.includePipelineChecks
      ? "Diagnose ohne Pipeline-Checks – bitte mit Pipeline-Checks erneut ausführen."
      : diagReadFailed
        ? "Diagnostik-Readiness konnte nicht gelesen werden (Storage-/Read-Fehler)"
      : describeReadinessContract({
          area: "diagnostic",
          state: diagnosticContract.state,
        });
  const reason = ciLiteContract.isVerified
    ? null
    : persistedCiLite.stale
      ? describeReadinessContract({
          area: "ci_lite",
          state: ciLiteContract.state,
          reason: persistedCiLite.reason,
        })
      : ciLiteReadFailed
        ? "CI-Lite-Readiness konnte nicht gelesen werden (Storage-/Read-Fehler)"
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
