import { fetchReconciliationRunStateBestEffort } from "../supabase/functions/check-eas-build/helpers";

describe("check-eas-build reconciliation best-effort run lookup", () => {
  it("returns run status data when lookup succeeds", async () => {
    const state = await fetchReconciliationRunStateBestEffort({
      enabled: true,
      fetchRun: async () => ({
        status: 200,
        ok: true,
        json: async () => ({ status: "completed", conclusion: "success" }),
      }),
    });
    expect(state).toEqual({
      attempted: true,
      upstream_status: 200,
      runStatus: "completed",
      runConclusion: "success",
      upstream_error: null,
    });
  });

  it("does not throw when lookup fails transiently and marks upstream error", async () => {
    const state = await fetchReconciliationRunStateBestEffort({
      enabled: true,
      fetchRun: async () => {
        throw new Error("network");
      },
    });
    expect(state).toEqual({
      attempted: true,
      upstream_status: null,
      runStatus: null,
      runConclusion: null,
      upstream_error: "github_lookup_failed",
    });
  });

  it("keeps endpoint behavior no-op when reconciliation lookup is disabled", async () => {
    const state = await fetchReconciliationRunStateBestEffort({
      enabled: false,
      fetchRun: async () => ({
        status: 200,
        ok: true,
        json: async () => ({}),
      }),
    });
    expect(state.attempted).toBe(false);
    expect(state.upstream_error).toBeNull();
  });

  it("keeps degraded truth when upstream returns non-OK status", async () => {
    const state = await fetchReconciliationRunStateBestEffort({
      enabled: true,
      fetchRun: async () => ({
        status: 503,
        ok: false,
        json: async () => ({ status: "completed", conclusion: "success" }),
      }),
    });
    expect(state).toEqual({
      attempted: true,
      upstream_status: 503,
      runStatus: null,
      runConclusion: null,
      upstream_error: null,
    });
  });
});
