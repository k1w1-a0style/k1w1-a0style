import { handleCheckEasBuildRequest } from "../supabase/functions/check-eas-build/routeCore";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

function makeRequest(jobId = 42): Request {
  return new Request("http://localhost/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-k1w1-admin-key": "admin-secret",
      authorization: `Bearer ${makeJwt({ role: "service_role" })}`,
    },
    body: JSON.stringify({ jobId }),
  });
}

const baseJob = {
  id: 42,
  status: "queued",
  github_repo: "owner/repo",
  github_run_id: 111,
  error_message: null,
};

describe("check-eas-build route behavior", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.K1W1_EDGE_WORKFLOW_ADMIN_KEY = "admin-secret";
    process.env.K1W1_SUPABASE_URL = "https://example.supabase.co";
    process.env.K1W1_SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ role: "service_role" }), { status: 200 });
      }
      if (url.includes("/rest/v1/rpc/enforce_edge_rate_limit")) {
        return new Response(JSON.stringify({ allowed: true, current_count: 1 }), { status: 200 });
      }
      return new Response("not-found", { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  function depsFor(job: Record<string, unknown>, onUpdate?: (patch: Record<string, unknown>) => void) {
    return {
      createSupabaseClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: job, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            onUpdate?.(patch);
            return { eq: async () => undefined };
          },
        }),
      }),
    };
  }

  it("returns DB status with truthful degraded metadata when GitHub lookup throws", async () => {
    const response = await handleCheckEasBuildRequest(makeRequest(), {
      ...depsFor(baseJob),
      fetchRunState: async () => ({
        attempted: true,
        upstream_status: null,
        runStatus: null,
        runConclusion: null,
        upstream_error: "github_lookup_failed",
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("queued");
    expect(payload.reconciliation).toEqual({
      attempted: true,
      reconciled: false,
      upstream_status: null,
      upstream_error: "github_lookup_failed",
    });
  });

  it("reports attempted/non-OK without fake reconciliation", async () => {
    const response = await handleCheckEasBuildRequest(makeRequest(), {
      ...depsFor(baseJob),
      fetchRunState: async () => ({
        attempted: true,
        upstream_status: 502,
        runStatus: null,
        runConclusion: null,
        upstream_error: null,
      }),
    });
    const payload = await response.json();
    expect(payload.status).toBe("queued");
    expect(payload.reconciliation.reconciled).toBe(false);
    expect(payload.reconciliation.upstream_status).toBe(502);
  });

  it("reports attempted OK but non-terminal run without reconcile", async () => {
    const response = await handleCheckEasBuildRequest(makeRequest(), {
      ...depsFor(baseJob),
      fetchRunState: async () => ({
        attempted: true,
        upstream_status: 200,
        runStatus: "in_progress",
        runConclusion: null,
        upstream_error: null,
      }),
    });
    const payload = await response.json();
    expect(payload.status).toBe("queued");
    expect(payload.reconciliation).toEqual({
      attempted: true,
      reconciled: false,
      upstream_status: 200,
      upstream_error: null,
    });
  });

  it("reconciles to terminal GitHub truth when run is completed", async () => {
    const onUpdate = jest.fn();
    const response = await handleCheckEasBuildRequest(makeRequest(), {
      ...depsFor(baseJob, onUpdate),
      fetchRunState: async () => ({
        attempted: true,
        upstream_status: 200,
        runStatus: "completed",
        runConclusion: "success",
        upstream_error: null,
      }),
    });
    const payload = await response.json();
    expect(payload.status).toBe("completed");
    expect(payload.reconciliation).toEqual({
      attempted: true,
      reconciled: true,
      upstream_status: 200,
      upstream_error: null,
    });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
  });

  it("does not claim reconcile when DB row is already terminal", async () => {
    const onUpdate = jest.fn();
    const response = await handleCheckEasBuildRequest(makeRequest(), {
      ...depsFor({ ...baseJob, status: "completed" }, onUpdate),
      fetchRunState: async () => ({
        attempted: true,
        upstream_status: 200,
        runStatus: "completed",
        runConclusion: "success",
        upstream_error: null,
      }),
    });
    const payload = await response.json();
    expect(payload.status).toBe("completed");
    expect(payload.reconciliation.reconciled).toBe(false);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("keeps not-attempted metadata truthful when no GitHub linkage exists", async () => {
    const response = await handleCheckEasBuildRequest(makeRequest(), {
      ...depsFor({ id: 42, status: "queued", github_repo: null, github_run_id: null }),
      fetchRunState: async () => {
        throw new Error("must not be called");
      },
    });
    const payload = await response.json();
    expect(payload.status).toBe("queued");
    expect(payload.reconciliation).toEqual({
      attempted: false,
      reconciled: false,
      upstream_status: null,
      upstream_error: null,
    });
  });
});
