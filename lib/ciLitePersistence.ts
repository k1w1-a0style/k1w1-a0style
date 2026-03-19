import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "./storageKeys";

const SHA_RE = /^[0-9a-f]{40}$/i;
const FINAL_CONCLUSIONS = new Set([
  "success",
  "failure",
  "cancelled",
  "timed_out",
  "action_required",
  "startup_failure",
  "stale",
  "skipped",
  "neutral",
]);

export const CI_LITE_PERSISTENCE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type PersistedCiLiteSnapshot = {
  repo: string;
  branch: string;
  sha: string;
  runAtMs: number;
  workflowId: string;
  jobId: string | null;
  runId: number | null;
  conclusion: string;
  lintOk: boolean;
  typecheckOk: boolean;
};

export type PersistedCiLiteSelectionCheck = {
  snapshot: PersistedCiLiteSnapshot | null;
  reason: string | null;
  stale: boolean;
};

type SelectionDeps = {
  storageGetItem?: (key: string) => Promise<string | null>;
  readBranchHeadSha?: (owner: string, repo: string, branch: string) => Promise<string>;
};

function parseRepoParts(repoFullName: string): { owner: string; repo: string } | null {
  const normalized = String(repoFullName ?? "").trim();
  const parts = normalized.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return {
    owner: parts[0].trim(),
    repo: parts[1].trim(),
  };
}

function readBooleanFlag(raw: string | null): boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function normalizeConclusion(rawConclusion: string | null | undefined, lintOk: boolean, typecheckOk: boolean): string {
  const normalized = String(rawConclusion ?? "").trim().toLowerCase();
  if (FINAL_CONCLUSIONS.has(normalized)) return normalized;
  return lintOk && typecheckOk ? "success" : "failure";
}

function parseOptionalPositiveInt(raw: string | null): number | null {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

export async function readPersistedCiLiteSelection(params: {
  repoFullName: string;
  branchName: string;
  deps?: SelectionDeps;
  requireGreen?: boolean;
}): Promise<PersistedCiLiteSelectionCheck> {
  const { repoFullName, branchName, deps, requireGreen = false } = params;
  const storageGetItem = deps?.storageGetItem ?? ((key: string) => AsyncStorage.getItem(key));
  const readBranchHeadSha = deps?.readBranchHeadSha;

  const [
    lintOkRaw,
    typeOkRaw,
    lastRepo,
    lastBranch,
    lastRunAt,
    lastSha,
    lastWorkflow,
    lastJobId,
    lastRunId,
    lastConclusion,
  ] = await Promise.all([
    storageGetItem(STORAGE_KEYS.CI_LITE_LINT_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_TYPECHECK_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_REPO).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_BRANCH).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_RUN_AT).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_SHA).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_WORKFLOW).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_JOB_ID).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_RUN_ID).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_CONCLUSION).catch(() => null),
  ]);

  const lintOk = readBooleanFlag(lintOkRaw);
  const typecheckOk = readBooleanFlag(typeOkRaw);
  if (lintOk === null || typecheckOk === null) {
    return { snapshot: null, reason: "CI-Lite Lint/Typecheck unklar", stale: false };
  }

  const repo = String(lastRepo ?? "").trim();
  const branch = String(lastBranch ?? "").trim();
  if (repo !== String(repoFullName ?? "").trim()) {
    return { snapshot: null, reason: "CI-Lite gehoert zu anderem Repo", stale: false };
  }
  if (branch !== String(branchName ?? "").trim()) {
    return { snapshot: null, reason: "CI-Lite gehoert zu anderem Branch", stale: false };
  }

  const runAtMs = Number(lastRunAt ?? "");
  const stale = !Number.isFinite(runAtMs) || runAtMs <= 0 || Date.now() - runAtMs > CI_LITE_PERSISTENCE_MAX_AGE_MS;
  if (stale) {
    return { snapshot: null, reason: "CI-Lite ist veraltet", stale: true };
  }

  const sha = String(lastSha ?? "").trim().toLowerCase();
  if (!SHA_RE.test(sha)) {
    return { snapshot: null, reason: "CI-Lite-SHA fehlt oder ist ungueltig", stale: false };
  }

  const workflowId = String(lastWorkflow ?? "").trim();
  if (workflowId && workflowId !== "k1w1-ci-lite.yml") {
    return { snapshot: null, reason: "CI-Lite-Workflow passt nicht zur Persistenz", stale: false };
  }

  if (readBranchHeadSha) {
    const repoParts = parseRepoParts(repoFullName);
    const selectedBranch = String(branchName ?? "").trim();
    if (!repoParts || !selectedBranch) {
      return { snapshot: null, reason: "Repo oder Branch fehlen", stale: false };
    }

    try {
      const currentHeadSha = String(
        await readBranchHeadSha(repoParts.owner, repoParts.repo, selectedBranch),
      ).trim().toLowerCase();
      if (!SHA_RE.test(currentHeadSha)) {
        return { snapshot: null, reason: "Branch-HEAD-SHA konnte nicht verifiziert werden", stale: false };
      }
      if (currentHeadSha !== sha) {
        return {
          snapshot: null,
          reason: "Repo/Branch wurden seit dem letzten CI-Lite-Run geaendert (SHA-Mismatch)",
          stale: false,
        };
      }
    } catch {
      return { snapshot: null, reason: "Branch-HEAD-SHA konnte nicht verifiziert werden", stale: false };
    }
  }

  const conclusion = normalizeConclusion(lastConclusion, lintOk, typecheckOk);
  if (requireGreen && (!lintOk || !typecheckOk || conclusion !== "success")) {
    return { snapshot: null, reason: "CI-Lite Lint/Typecheck nicht gruen", stale: false };
  }

  return {
    snapshot: {
      repo,
      branch,
      sha,
      runAtMs,
      workflowId: workflowId || "k1w1-ci-lite.yml",
      jobId: String(lastJobId ?? "").trim() || null,
      runId: parseOptionalPositiveInt(lastRunId),
      conclusion,
      lintOk,
      typecheckOk,
    },
    reason: null,
    stale: false,
  };
}
