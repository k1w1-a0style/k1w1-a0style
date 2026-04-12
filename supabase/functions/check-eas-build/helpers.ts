export type ReconciliationRunState = {
  attempted: boolean;
  upstream_status: number | null;
  runStatus: string | null;
  runConclusion: string | null;
  upstream_error: string | null;
};

export async function fetchReconciliationRunStateBestEffort(params: {
  enabled: boolean;
  fetchRun: () => Promise<{ status: number; ok: boolean; json: () => Promise<unknown> }>;
}): Promise<ReconciliationRunState> {
  if (!params.enabled) {
    return {
      attempted: false,
      upstream_status: null,
      runStatus: null,
      runConclusion: null,
      upstream_error: null,
    };
  }

  try {
    const response = await params.fetchRun();
    const out: ReconciliationRunState = {
      attempted: true,
      upstream_status: response.status,
      runStatus: null,
      runConclusion: null,
      upstream_error: null,
    };
    if (!response.ok) return out;
    const runJson = await response.json().catch(() => null) as {
      status?: string | null;
      conclusion?: string | null;
    } | null;
    out.runStatus = typeof runJson?.status === "string" ? runJson.status : null;
    out.runConclusion = typeof runJson?.conclusion === "string" ? runJson.conclusion : null;
    return out;
  } catch {
    return {
      attempted: true,
      upstream_status: null,
      runStatus: null,
      runConclusion: null,
      upstream_error: "github_lookup_failed",
    };
  }
}
