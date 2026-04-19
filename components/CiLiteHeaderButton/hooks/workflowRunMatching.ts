export type WorkflowRunLocatorCandidate = {
  id?: unknown;
  html_url?: unknown;
  display_title?: unknown;
  name?: unknown;
  created_at?: unknown;
  event?: unknown;
  head_branch?: unknown;
  head_sha?: unknown;
} | null | undefined;

export type WorkflowRunMatchTier =
  | "exact_job_id"
  | "head_sha_fallback"
  | "single_dispatch_fallback";

export type WorkflowRunLookupDiagnosis = {
  exactJobIdMatchFound: boolean;
  fallbackCandidateCount: number;
  ambiguous: boolean;
  contractMismatchLikely: boolean;
  plausibleCandidateCount: number;
  selectedTier: WorkflowRunMatchTier | null;
};

export type WorkflowRunCandidateSelection = {
  candidate: WorkflowRunLocatorCandidate;
  diagnosis: WorkflowRunLookupDiagnosis;
};

const MAX_RUN_START_SKEW_MS = 10_000;
const DISPATCH_SHA_FRESH_WINDOW_MS = 120_000;
const DISPATCH_UNIQUE_FRESH_WINDOW_MS = 45_000;

function hasExactJobIdMarkerInRun(run: { display_title?: unknown; name?: unknown } | null | undefined, jobId: string): boolean {
  const jid = String(jobId || "").trim();
  if (!run || !jid) return false;
  const title = String(run.display_title ?? run.name ?? "").trim();
  if (!title) return false;
  return (
    title.includes(`[${jid}]`) ||
    title.includes(`(job_id=${jid})`) ||
    title.includes(`job_id=${jid}`) ||
    title.includes(`job_id: ${jid}`)
  );
}

function parseCreatedAtMs(run: { created_at?: unknown } | null | undefined): number {
  return typeof run?.created_at === "string" ? Date.parse(run.created_at) : Number.NaN;
}

function isFreshChainRunCandidate(run: { created_at?: unknown } | null | undefined, chainStartMs: number): boolean {
  if (!run) return false;
  const createdAt = parseCreatedAtMs(run);
  if (!Number.isFinite(createdAt)) return true;
  return createdAt >= chainStartMs - 5_000;
}

function isWithinFreshWindow(
  run: WorkflowRunLocatorCandidate,
  startedAtMs: number,
  windowMs: number,
): boolean {
  const createdAt = parseCreatedAtMs(run);
  if (!Number.isFinite(createdAt)) return false;
  const lowerBound = startedAtMs - MAX_RUN_START_SKEW_MS;
  const upperBound = startedAtMs + windowMs;
  return createdAt >= lowerBound && createdAt <= upperBound;
}

function hasExactHeadSha(run: WorkflowRunLocatorCandidate, sha: string | null | undefined): boolean {
  const expected = String(sha || "").trim();
  if (!expected) return false;
  const actual = typeof run?.head_sha === "string" ? run.head_sha.trim() : "";
  return !!actual && actual === expected;
}

function hasExpectedEvent(run: WorkflowRunLocatorCandidate, expectedEvent: "repository_dispatch" | "workflow_dispatch"): boolean {
  const event = typeof run?.event === "string" ? run.event.trim().toLowerCase() : "";
  return !event || event === expectedEvent;
}

function hasExpectedBranch(run: WorkflowRunLocatorCandidate, branch: string): boolean {
  const targetBranch = String(branch || "").trim();
  if (!targetBranch) return false;
  const headBranch = typeof run?.head_branch === "string" ? run.head_branch.trim() : "";
  return !headBranch || headBranch === targetBranch;
}

function isPlausibleWorkflowDispatchFallbackCandidate(
  run: WorkflowRunLocatorCandidate,
  opts: {
    branch: string;
    startedAtMs: number;
    sourceHeadSha?: string | null;
  },
): boolean {
  if (!run) return false;
  if (!hasExpectedEvent(run, "workflow_dispatch")) return false;
  if (!hasExpectedBranch(run, opts.branch)) return false;
  if (!isWithinFreshWindow(run, opts.startedAtMs, DISPATCH_UNIQUE_FRESH_WINDOW_MS)) return false;

  const expectedSha = String(opts.sourceHeadSha || "").trim();
  if (!expectedSha) return true;

  const actualSha = typeof run?.head_sha === "string" ? run.head_sha.trim() : "";
  return !actualSha || actualSha === expectedSha;
}

export function matchesWorkflowRunContract(
  run: WorkflowRunLocatorCandidate,
  opts: {
    jobId: string;
    branch: string;
    startedAtMs: number;
    expectedEvent: "repository_dispatch" | "workflow_dispatch";
    sourceHeadSha?: string | null;
    requireJobIdMarker?: boolean;
  },
): boolean {
  const targetBranch = String(opts.branch || "").trim();
  if (!targetBranch) return false;
  if (!isFreshChainRunCandidate(run, opts.startedAtMs)) return false;

  const event = typeof run?.event === "string" ? run.event.trim().toLowerCase() : "";
  if (event && event !== opts.expectedEvent) return false;

  const headBranch = typeof run?.head_branch === "string" ? run.head_branch.trim() : "";
  if (headBranch && headBranch !== targetBranch) return false;

  if (opts.requireJobIdMarker !== false && !hasExactJobIdMarkerInRun(run, opts.jobId)) return false;

  if (opts.sourceHeadSha && typeof run?.head_sha === "string" && !hasExactHeadSha(run, opts.sourceHeadSha)) {
    return false;
  }

  return opts.requireJobIdMarker === false
    ? hasExactJobIdMarkerInRun(run, opts.jobId) || hasExactHeadSha(run, opts.sourceHeadSha)
    : true;
}

export function chooseWorkflowRunCandidateDetailed(
  runs: WorkflowRunLocatorCandidate[],
  opts: {
    jobId: string;
    branch: string;
    startedAtMs: number;
    expectedEvent: "repository_dispatch" | "workflow_dispatch";
    sourceHeadSha?: string | null;
    requireJobIdMarker?: boolean;
  },
): WorkflowRunCandidateSelection {
  const exactMatches = runs.filter((run) =>
    matchesWorkflowRunContract(run, {
      ...opts,
      requireJobIdMarker: true,
    }),
  );

  const exactHeadShaMatch = opts.sourceHeadSha
    ? exactMatches.find((run) => hasExactHeadSha(run, opts.sourceHeadSha))
    : null;
  const exactCandidate = exactHeadShaMatch ?? exactMatches[0] ?? null;

  if (exactCandidate) {
    return {
      candidate: exactCandidate,
      diagnosis: {
        exactJobIdMatchFound: true,
        fallbackCandidateCount: 0,
        ambiguous: false,
        contractMismatchLikely: false,
        plausibleCandidateCount: exactMatches.length,
        selectedTier: "exact_job_id",
      },
    };
  }

  if (opts.expectedEvent !== "workflow_dispatch" || opts.requireJobIdMarker !== false) {
    if (opts.expectedEvent === "workflow_dispatch") {
      const plausibleDispatchCandidates = runs.filter((run) =>
        isPlausibleWorkflowDispatchFallbackCandidate(run, {
          branch: opts.branch,
          startedAtMs: opts.startedAtMs,
          sourceHeadSha: opts.sourceHeadSha,
        }),
      );

      if (plausibleDispatchCandidates.length > 0) {
        return {
          candidate: null,
          diagnosis: {
            exactJobIdMatchFound: false,
            fallbackCandidateCount: plausibleDispatchCandidates.length,
            ambiguous: plausibleDispatchCandidates.length > 1,
            contractMismatchLikely: true,
            plausibleCandidateCount: plausibleDispatchCandidates.length,
            selectedTier: null,
          },
        };
      }
    }

    return {
      candidate: null,
      diagnosis: {
        exactJobIdMatchFound: false,
        fallbackCandidateCount: 0,
        ambiguous: false,
        contractMismatchLikely: false,
        plausibleCandidateCount: 0,
        selectedTier: null,
      },
    };
  }

  const plausibleDispatchCandidates = runs.filter((run) =>
    isPlausibleWorkflowDispatchFallbackCandidate(run, {
      branch: opts.branch,
      startedAtMs: opts.startedAtMs,
      sourceHeadSha: opts.sourceHeadSha,
    }),
  );

  const headShaFallbackCandidates = opts.sourceHeadSha
    ? plausibleDispatchCandidates.filter((run) =>
        hasExactHeadSha(run, opts.sourceHeadSha) &&
        isWithinFreshWindow(run, opts.startedAtMs, DISPATCH_SHA_FRESH_WINDOW_MS),
      )
    : [];

  if (headShaFallbackCandidates.length === 1) {
    return {
      candidate: headShaFallbackCandidates[0] ?? null,
      diagnosis: {
        exactJobIdMatchFound: false,
        fallbackCandidateCount: headShaFallbackCandidates.length,
        ambiguous: false,
        contractMismatchLikely: false,
        plausibleCandidateCount: plausibleDispatchCandidates.length,
        selectedTier: "head_sha_fallback",
      },
    };
  }

  if (headShaFallbackCandidates.length > 1) {
    return {
      candidate: null,
      diagnosis: {
        exactJobIdMatchFound: false,
        fallbackCandidateCount: headShaFallbackCandidates.length,
        ambiguous: true,
        contractMismatchLikely: false,
        plausibleCandidateCount: plausibleDispatchCandidates.length,
        selectedTier: null,
      },
    };
  }

  if (plausibleDispatchCandidates.length === 1) {
    return {
      candidate: plausibleDispatchCandidates[0] ?? null,
      diagnosis: {
        exactJobIdMatchFound: false,
        fallbackCandidateCount: plausibleDispatchCandidates.length,
        ambiguous: false,
        contractMismatchLikely: true,
        plausibleCandidateCount: plausibleDispatchCandidates.length,
        selectedTier: "single_dispatch_fallback",
      },
    };
  }

  if (plausibleDispatchCandidates.length > 1) {
    return {
      candidate: null,
      diagnosis: {
        exactJobIdMatchFound: false,
        fallbackCandidateCount: plausibleDispatchCandidates.length,
        ambiguous: true,
        contractMismatchLikely: false,
        plausibleCandidateCount: plausibleDispatchCandidates.length,
        selectedTier: null,
      },
    };
  }

  const sameEventBranchCandidates = runs.filter(
    (run) => hasExpectedEvent(run, "workflow_dispatch") && hasExpectedBranch(run, opts.branch),
  );

  return {
    candidate: null,
    diagnosis: {
      exactJobIdMatchFound: false,
      fallbackCandidateCount: 0,
      ambiguous: false,
      contractMismatchLikely: sameEventBranchCandidates.length > 0,
      plausibleCandidateCount: sameEventBranchCandidates.length,
      selectedTier: null,
    },
  };
}

export function chooseWorkflowRunCandidate(
  runs: WorkflowRunLocatorCandidate[],
  opts: {
    jobId: string;
    branch: string;
    startedAtMs: number;
    expectedEvent: "repository_dispatch" | "workflow_dispatch";
    sourceHeadSha?: string | null;
    requireJobIdMarker?: boolean;
  },
): WorkflowRunLocatorCandidate {
  return chooseWorkflowRunCandidateDetailed(runs, opts).candidate;
}
