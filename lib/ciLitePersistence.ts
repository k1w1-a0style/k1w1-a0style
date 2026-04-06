import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS, ciLiteSnapshotKeyForSelection } from "./storageKeys";

const SHA_RE = /^[0-9a-f]{40}$/i;
export const CI_LITE_WORKFLOW_ID = "k1w1-ci-lite.yml";
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

export const CI_LITE_PERSISTENCE_REASONS = {
  LINT_TYPECHECK_UNCLEAR: "CI-Lite Lint/Typecheck unklar",
  PERSISTENCE_MISSING: "CI-Lite-Persistenz fehlt oder ist unvollständig",
  REPO_MISMATCH: "CI-Lite gehoert zu anderem Repo",
  BRANCH_MISMATCH: "CI-Lite gehoert zu anderem Branch",
  INVALID_TIMESTAMP: "CI-Lite-Zeitstempel fehlt oder ist ungueltig",
  STALE: "CI-Lite ist veraltet",
  INVALID_SHA: "CI-Lite-SHA fehlt oder ist ungueltig",
  WORKFLOW_MISMATCH: "CI-Lite-Workflow passt nicht zur Persistenz",
  REPO_OR_BRANCH_MISSING: "Repo oder Branch fehlen",
  HEAD_UNVERIFIED: "Branch-HEAD-SHA konnte nicht verifiziert werden",
  SHA_MISMATCH: "Repo/Branch wurden seit dem letzten CI-Lite-Run geaendert (SHA-Mismatch)",
  NOT_GREEN: "CI-Lite Lint/Typecheck nicht gruen",
} as const;

export type CiLitePersistenceReason =
  (typeof CI_LITE_PERSISTENCE_REASONS)[keyof typeof CI_LITE_PERSISTENCE_REASONS];

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
  reason: CiLitePersistenceReason | null;
  stale: boolean;
};

type SelectionDeps = {
  storageGetItem?: (key: string) => Promise<string | null>;
  readBranchHeadSha?: (owner: string, repo: string, branch: string) => Promise<string>;
};

type ScopedSnapshotReadResult = {
  parsed: PersistedCiLiteSnapshot | null;
  parseReason: CiLitePersistenceReason | null;
};

async function safeStorageGet(
  storageGetItem: (key: string) => Promise<string | null>,
  key: string,
): Promise<string | null> {
  return storageGetItem(key).catch(() => null);
}

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

function normalizeRepo(raw: unknown): string {
  return String(raw ?? "").trim();
}

function normalizeBranch(raw: unknown): string {
  return String(raw ?? "").trim();
}

type ParsedSnapshotResult = {
  snapshot: PersistedCiLiteSnapshot | null;
  reason: CiLitePersistenceReason | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSnapshotRecord(parsed: Record<string, unknown>): ParsedSnapshotResult {
  const lintOk = typeof parsed.lintOk === "boolean" ? parsed.lintOk : null;
  const typecheckOk = typeof parsed.typecheckOk === "boolean" ? parsed.typecheckOk : null;
  if (lintOk === null || typecheckOk === null) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.LINT_TYPECHECK_UNCLEAR };
  }

  const repo = normalizeRepo(parsed.repo);
  const branch = normalizeBranch(parsed.branch);
  if (!repo || !branch) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.PERSISTENCE_MISSING };
  }

  const runAtMs = Number(parsed.runAtMs ?? "");
  const sha = String(parsed.sha ?? "").trim().toLowerCase();
  const workflowId = String(parsed.workflowId ?? "").trim() || CI_LITE_WORKFLOW_ID;
  const jobId = String(parsed.jobId ?? "").trim() || null;
  const runIdRaw = parsed.runId;
  const runId =
    typeof runIdRaw === "number"
      ? parseOptionalPositiveInt(String(runIdRaw))
      : parseOptionalPositiveInt(typeof runIdRaw === "string" ? runIdRaw : null);

  return {
    snapshot: {
      repo,
      branch,
      sha,
      runAtMs,
      workflowId,
      jobId,
      runId,
      conclusion: normalizeConclusion(String(parsed.conclusion ?? ""), lintOk, typecheckOk),
      lintOk,
      typecheckOk,
    },
    reason: null,
  };
}

function parseSnapshotFromRaw(raw: string | null): ParsedSnapshotResult {
  if (!raw) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.PERSISTENCE_MISSING };
  }

  try {
    return parseSnapshotFromUnknown(JSON.parse(raw));
  } catch {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.PERSISTENCE_MISSING };
  }
}

function parseSnapshotFromUnknown(parsed: unknown): ParsedSnapshotResult {
  if (!isRecord(parsed)) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.PERSISTENCE_MISSING };
  }
  return parseSnapshotRecord(parsed);
}

async function readScopedOrLegacySnapshotRaw(
  storageGetItem: (key: string) => Promise<string | null>,
  params: { repoFullName: string; branchName: string },
): Promise<ScopedSnapshotReadResult> {
  const scopedKey = ciLiteSnapshotKeyForSelection({
    linkedRepo: params.repoFullName,
    linkedBranch: params.branchName,
  });
  const scopedRaw = await safeStorageGet(storageGetItem, scopedKey);
  if (scopedRaw != null) {
    const parsed = parseSnapshotFromRaw(scopedRaw);
    return { parsed: parsed.snapshot, parseReason: parsed.reason };
  }

  const [lintOkRaw, typeOkRaw, lastRepo, lastBranch, lastRunAt, lastSha, lastWorkflow, lastJobId, lastRunId, lastConclusion] =
    await Promise.all([
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_LINT_OK),
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_TYPECHECK_OK),
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_LAST_REPO),
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_LAST_BRANCH),
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_LAST_RUN_AT),
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_LAST_SHA),
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_LAST_WORKFLOW),
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_LAST_JOB_ID),
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_LAST_RUN_ID),
      safeStorageGet(storageGetItem, STORAGE_KEYS.CI_LITE_LAST_CONCLUSION),
    ]);

  const legacySnapshot = {
    repo: normalizeRepo(lastRepo),
    branch: normalizeBranch(lastBranch),
    sha: String(lastSha ?? "").trim().toLowerCase(),
    runAtMs: Number(lastRunAt ?? ""),
    workflowId: String(lastWorkflow ?? "").trim() || CI_LITE_WORKFLOW_ID,
    jobId: String(lastJobId ?? "").trim() || null,
    runId: parseOptionalPositiveInt(lastRunId),
    conclusion: String(lastConclusion ?? "").trim(),
    lintOk: readBooleanFlag(lintOkRaw),
    typecheckOk: readBooleanFlag(typeOkRaw),
  };

  const parsedLegacy = parseSnapshotFromUnknown(legacySnapshot);
  return {
    parsed: parsedLegacy.snapshot,
    parseReason: parsedLegacy.reason,
  };
}

function validateSnapshotForSelection(params: {
  snapshot: PersistedCiLiteSnapshot | null;
  expectedRepo: string;
  expectedBranch: string;
}): PersistedCiLiteSelectionCheck {
  const { snapshot, expectedRepo, expectedBranch } = params;
  if (!snapshot) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.PERSISTENCE_MISSING, stale: false };
  }

  if (snapshot.repo !== expectedRepo) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.REPO_MISMATCH, stale: false };
  }

  if (snapshot.branch !== expectedBranch) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.BRANCH_MISMATCH, stale: false };
  }

  if (!Number.isFinite(snapshot.runAtMs) || snapshot.runAtMs <= 0) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.INVALID_TIMESTAMP, stale: false };
  }
  const stale = Date.now() - snapshot.runAtMs > CI_LITE_PERSISTENCE_MAX_AGE_MS;

  if (stale) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.STALE, stale: true };
  }

  if (!SHA_RE.test(snapshot.sha)) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.INVALID_SHA, stale: false };
  }

  if (snapshot.workflowId && snapshot.workflowId !== CI_LITE_WORKFLOW_ID) {
    return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.WORKFLOW_MISMATCH, stale: false };
  }

  return { snapshot, reason: null, stale: false };
}

/**
 * Preferred CI-Lite source of truth: repo/branch-scoped snapshot.
 * Legacy flat keys remain read-only fallback for migration while older writers/readers exist.
 */
export async function readPersistedCiLiteSelection(params: {
  repoFullName: string;
  branchName: string;
  deps?: SelectionDeps;
  requireGreen?: boolean;
}): Promise<PersistedCiLiteSelectionCheck> {
  const { repoFullName, branchName, deps, requireGreen = false } = params;
  const storageGetItem = deps?.storageGetItem ?? ((key: string) => AsyncStorage.getItem(key));
  const readBranchHeadSha = deps?.readBranchHeadSha;
  const expectedRepo = String(repoFullName ?? "").trim();
  const expectedBranch = String(branchName ?? "").trim();

  const persistedRaw = await readScopedOrLegacySnapshotRaw(storageGetItem, {
    repoFullName: expectedRepo,
    branchName: expectedBranch,
  });
  if (!persistedRaw.parsed) {
    return {
      snapshot: null,
      reason: persistedRaw.parseReason ?? CI_LITE_PERSISTENCE_REASONS.PERSISTENCE_MISSING,
      stale: false,
    };
  }
  const validated = validateSnapshotForSelection({
    snapshot: persistedRaw.parsed,
    expectedRepo,
    expectedBranch,
  });
  if (!validated.snapshot) return validated;

  if (readBranchHeadSha) {
    const repoParts = parseRepoParts(expectedRepo);
    if (!repoParts || !expectedBranch) {
      return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.REPO_OR_BRANCH_MISSING, stale: false };
    }

    try {
      const currentHeadSha = String(
        await readBranchHeadSha(repoParts.owner, repoParts.repo, expectedBranch),
      ).trim().toLowerCase();
      if (!SHA_RE.test(currentHeadSha)) {
        return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.HEAD_UNVERIFIED, stale: false };
      }
      if (currentHeadSha !== validated.snapshot.sha) {
        return {
          snapshot: null,
          reason: CI_LITE_PERSISTENCE_REASONS.SHA_MISMATCH,
          stale: false,
        };
      }
    } catch {
      return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.HEAD_UNVERIFIED, stale: false };
    }
  }

  if (requireGreen) {
    const isGreen = validated.snapshot.lintOk && validated.snapshot.typecheckOk && validated.snapshot.conclusion === "success";
    if (!isGreen) {
      return { snapshot: null, reason: CI_LITE_PERSISTENCE_REASONS.NOT_GREEN, stale: false };
    }
  }

  return validated;
}

export function buildPersistCiLiteEntries(params: {
  snapshot: PersistedCiLiteSnapshot;
  includeLegacyMirror?: boolean;
}): [string, string][] {
  const { snapshot, includeLegacyMirror = true } = params;
  const normalizedSnapshot: PersistedCiLiteSnapshot = {
    repo: normalizeRepo(snapshot.repo),
    branch: normalizeBranch(snapshot.branch),
    sha: String(snapshot.sha ?? "").trim().toLowerCase(),
    runAtMs: Number(snapshot.runAtMs ?? ""),
    workflowId: String(snapshot.workflowId ?? "").trim() || CI_LITE_WORKFLOW_ID,
    jobId: String(snapshot.jobId ?? "").trim() || null,
    runId:
      typeof snapshot.runId === "number" && Number.isFinite(snapshot.runId) && snapshot.runId > 0
        ? Math.trunc(snapshot.runId)
        : null,
    conclusion: normalizeConclusion(snapshot.conclusion, snapshot.lintOk, snapshot.typecheckOk),
    lintOk: Boolean(snapshot.lintOk),
    typecheckOk: Boolean(snapshot.typecheckOk),
  };

  const entries: [string, string][] = [
    [
      ciLiteSnapshotKeyForSelection({
        linkedRepo: normalizedSnapshot.repo,
        linkedBranch: normalizedSnapshot.branch,
      }),
      JSON.stringify(normalizedSnapshot),
    ],
  ];

  if (!includeLegacyMirror) {
    return entries;
  }

  entries.push(
    [STORAGE_KEYS.CI_LITE_LINT_OK, normalizedSnapshot.lintOk ? "true" : "false"],
    [STORAGE_KEYS.CI_LITE_TYPECHECK_OK, normalizedSnapshot.typecheckOk ? "true" : "false"],
    [STORAGE_KEYS.CI_LITE_LAST_RUN_AT, String(normalizedSnapshot.runAtMs)],
    [STORAGE_KEYS.CI_LITE_LAST_REPO, normalizedSnapshot.repo],
    [STORAGE_KEYS.CI_LITE_LAST_BRANCH, normalizedSnapshot.branch],
    [STORAGE_KEYS.CI_LITE_LAST_SHA, normalizedSnapshot.sha],
    [STORAGE_KEYS.CI_LITE_LAST_WORKFLOW, normalizedSnapshot.workflowId],
    [STORAGE_KEYS.CI_LITE_LAST_JOB_ID, normalizedSnapshot.jobId ?? ""],
    [STORAGE_KEYS.CI_LITE_LAST_RUN_ID, normalizedSnapshot.runId != null ? String(normalizedSnapshot.runId) : ""],
    [STORAGE_KEYS.CI_LITE_LAST_CONCLUSION, normalizedSnapshot.conclusion],
  );

  return entries;
}
