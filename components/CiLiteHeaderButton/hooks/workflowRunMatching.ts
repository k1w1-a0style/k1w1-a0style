type WorkflowRunLocatorCandidate = {
  id?: unknown;
  html_url?: unknown;
  display_title?: unknown;
  name?: unknown;
  created_at?: unknown;
  event?: unknown;
  head_branch?: unknown;
  head_sha?: unknown;
} | null | undefined;

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

function isFreshChainRunCandidate(run: { created_at?: unknown } | null | undefined, chainStartMs: number): boolean {
  if (!run) return false;
  const createdAt = typeof run.created_at === "string" ? Date.parse(run.created_at) : Number.NaN;
  if (!Number.isFinite(createdAt)) return true;
  return createdAt >= chainStartMs - 5_000;
}

function hasExactHeadSha(run: WorkflowRunLocatorCandidate, sha: string | null | undefined): boolean {
  const expected = String(sha || "").trim();
  if (!expected) return false;
  const actual = typeof run?.head_sha === "string" ? run.head_sha.trim() : "";
  return !!actual && actual === expected;
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
  const eligibleRuns = runs.filter((run) =>
    matchesWorkflowRunContract(run, opts),
  );

  const exactHeadShaMatch = opts.sourceHeadSha
    ? eligibleRuns.find((run) => hasExactHeadSha(run, opts.sourceHeadSha))
    : null;

  return exactHeadShaMatch ?? eligibleRuns[0] ?? null;
}
