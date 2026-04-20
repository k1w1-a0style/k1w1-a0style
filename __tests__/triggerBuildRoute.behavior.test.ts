import { handleTriggerEasBuildRequest } from "../supabase/functions/trigger-eas-build/routeCore";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/trigger", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-k1w1-admin-key": "admin-secret",
      authorization: `Bearer ${makeJwt({ role: "service_role" })}`,
      "x-forwarded-for": "198.51.100.8, 10.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

describe("trigger-eas-build route behavior", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.K1W1_EDGE_WORKFLOW_ADMIN_KEY = "admin-secret";
    process.env.K1W1_SUPABASE_URL = "https://example.supabase.co";
    process.env.K1W1_SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.GITHUB_TOKEN = "gh-token";
    process.env.K1W1_ALLOWED_GITHUB_REPOS = "owner/repo";
    process.env.K1W1_ALLOWED_REF_REGEX = "^(main|develop|feature/.+|release/.+)$";
    process.env.K1W1_TRUSTED_PROXY_HOPS = "1";
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

  it("keeps real route alive when SHA lookup fails and dispatches branch ref + source_commit_sha null", async () => {
    const insertSingle = jest.fn(async () => ({ data: { id: 123 }, error: null }));
    const dispatch = jest.fn(async () => ({ ok: true, status: 204, bodyText: "" }));
    const updateEq = jest.fn(async () => undefined);

    const response = await handleTriggerEasBuildRequest(
      makeRequest({ githubRepo: "owner/repo", buildProfile: "preview", branch: "feature/x" }),
      {
        createSupabaseClient: () => ({
          from: () => ({
            insert: () => ({ select: () => ({ single: insertSingle }) }),
            update: () => ({ eq: updateEq }),
          }),
        }),
        resolveCommitShaBestEffort: async () => null,
        githubDispatch: dispatch,
      },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.source_commit_sha).toBeNull();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        client_payload: expect.objectContaining({
          ref: "feature/x",
          source_commit_sha: null,
        }),
      }),
    }));
    expect(updateEq).not.toHaveBeenCalled();
  });

  it("pins SHA in dispatch and patches queued build job on dispatch failure", async () => {
    const patchEq = jest.fn(async () => undefined);
    const response = await handleTriggerEasBuildRequest(
      makeRequest({ githubRepo: "owner/repo", buildProfile: "production", branch: "main" }),
      {
        createSupabaseClient: () => ({
          from: () => ({
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 99 }, error: null }),
              }),
            }),
            update: (patch: Record<string, unknown>) => {
              expect(patch).toEqual(expect.objectContaining({
                status: "error",
                error_message: "dispatch_failed:502",
                source_commit_sha: "abc123",
              }));
              return { eq: patchEq };
            },
          }),
        }),
        resolveCommitShaBestEffort: async () => "abc123",
        githubDispatch: async ({ payload }) => {
          expect(payload).toEqual(expect.objectContaining({
            client_payload: expect.objectContaining({
              ref: "abc123",
              source_commit_sha: "abc123",
            }),
          }));
          return { ok: false, status: 502, bodyText: "bad gateway" };
        },
      },
    );

    expect(response.status).toBe(502);
    expect(patchEq).toHaveBeenCalledWith("id", 99);
  });
});
