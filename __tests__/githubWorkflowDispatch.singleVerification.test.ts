function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function withEnv<T>(patch: Record<string, string | undefined>, run: () => T | Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await run();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

type RouteHandler = (req: Request) => Promise<Response> | Response;
type RuntimeGlobal = typeof globalThis & { Deno?: { serve: (handler: RouteHandler) => unknown } };

function loadDispatchHandler(): RouteHandler {
  let captured: RouteHandler | null = null;
  const runtimeGlobal = globalThis as RuntimeGlobal;
  const previousDeno = runtimeGlobal.Deno;
  runtimeGlobal.Deno = {
    serve: (handler: RouteHandler) => {
      captured = handler;
      return {};
    },
  };

  jest.resetModules();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("../supabase/functions/github-workflow-dispatch/index.ts");
  } finally {
    runtimeGlobal.Deno = previousDeno;
  }

  if (!captured) throw new Error("github-workflow-dispatch handler was not registered");
  return captured;
}

describe("github-workflow-dispatch single JWT verification contract", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it("verifies JWT once and keeps trusted IP priority over actor fallback", async () => {
    const authToken = makeJwt({ role: "build_admin", sub: "verified-subject" });
    const authCalls: string[] = [];
    const durableSubjects: string[] = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        authCalls.push(url);
        return new Response(JSON.stringify({ id: "verified-user-id", role: "authenticated" }), { status: 200 });
      }
      if (url.includes("/rest/v1/rpc/enforce_edge_rate_limit")) {
        const parsed = typeof init?.body === "string" ? JSON.parse(init.body) as { p_subject?: string } : {};
        durableSubjects.push(parsed.p_subject ?? "");
        return new Response(JSON.stringify([{ allowed: true, current_count: 1 }]), { status: 200 });
      }
      if (url.includes("/actions/workflows?")) {
        return new Response(JSON.stringify({ workflows: [{ id: 77, path: ".github/workflows/k1w1-ci-lite.yml" }] }), { status: 200 });
      }
      if (url.includes("/actions/workflows/77/dispatches")) {
        return new Response(null, { status: 204 });
      }
      return new Response("not-found", { status: 404 });
    }) as typeof fetch;

    const handler = loadDispatchHandler();

    const response = await withEnv(
      {
        ENVIRONMENT: "development",
        K1W1_EDGE_WORKFLOW_ADMIN_KEY: "admin-secret",
        K1W1_SUPABASE_URL: "https://example.supabase.co",
        K1W1_SUPABASE_SERVICE_ROLE_KEY: "service-role",
        GITHUB_TOKEN: "gh-token",
        K1W1_ALLOWED_GITHUB_REPOS: "owner/repo",
        K1W1_ALLOWED_REF_REGEX: "^(main)$",
        K1W1_TRUSTED_PROXY_HOPS: "1",
      },
      () => handler(new Request("http://localhost/github-workflow-dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authToken}`,
          "x-forwarded-for": "198.51.100.20, 10.0.0.1",
        },
        body: JSON.stringify({
          githubRepo: "owner/repo",
          workflow: "k1w1-ci-lite.yml",
          ref: "main",
          inputs: {},
        }),
      })),
    );

    expect(response.status).toBe(200);
    expect(authCalls).toHaveLength(1);
    expect(durableSubjects).toContain("ip:198.51.100.20");
    expect(durableSubjects).not.toContain("actor:verified-user-id");
  });

  it("fails closed without trusted IP and without verified actor fallback", async () => {
    const authToken = makeJwt({ role: "build_admin", sub: "" });

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "", role: "authenticated" }), { status: 200 });
      }
      return new Response("not-found", { status: 404 });
    }) as typeof fetch;

    const handler = loadDispatchHandler();
    const response = await withEnv(
      {
        ENVIRONMENT: "development",
        K1W1_EDGE_WORKFLOW_ADMIN_KEY: "admin-secret",
        K1W1_SUPABASE_URL: "https://example.supabase.co",
        K1W1_SUPABASE_SERVICE_ROLE_KEY: "service-role",
        GITHUB_TOKEN: "gh-token",
        K1W1_ALLOWED_GITHUB_REPOS: "owner/repo",
        K1W1_ALLOWED_REF_REGEX: "^(main)$",
      },
      () => handler(new Request("http://localhost/github-workflow-dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          githubRepo: "owner/repo",
          workflow: "k1w1-ci-lite.yml",
          ref: "main",
          inputs: {},
        }),
      })),
    );

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toContain("verified JWT actor missing");
  });

  it("accepts an allowlisted alias and dispatches the mapped workflow file", async () => {
    const authToken = makeJwt({ role: "build_admin", sub: "verified-subject" });
    const dispatchHits: string[] = [];

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "verified-user-id", role: "authenticated" }), { status: 200 });
      }
      if (url.includes("/rest/v1/rpc/enforce_edge_rate_limit")) {
        return new Response(JSON.stringify([{ allowed: true, current_count: 1 }]), { status: 200 });
      }
      if (url.includes("/actions/workflows?")) {
        return new Response(JSON.stringify({ workflows: [{ id: 77, path: ".github/workflows/k1w1-ci-lite.yml" }] }), { status: 200 });
      }
      if (url.includes("/actions/workflows/77/dispatches")) {
        dispatchHits.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response("not-found", { status: 404 });
    }) as typeof fetch;

    const handler = loadDispatchHandler();
    const response = await withEnv(
      {
        ENVIRONMENT: "development",
        K1W1_EDGE_WORKFLOW_ADMIN_KEY: "admin-secret",
        K1W1_SUPABASE_URL: "https://example.supabase.co",
        K1W1_SUPABASE_SERVICE_ROLE_KEY: "service-role",
        GITHUB_TOKEN: "gh-token",
        K1W1_ALLOWED_GITHUB_REPOS: "owner/repo",
        K1W1_ALLOWED_REF_REGEX: "^(main)$",
        K1W1_TRUSTED_PROXY_HOPS: "1",
      },
      () => handler(new Request("http://localhost/github-workflow-dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authToken}`,
          "x-forwarded-for": "198.51.100.20, 10.0.0.1",
        },
        body: JSON.stringify({
          githubRepo: "owner/repo",
          workflow: "ci",
          ref: "main",
        }),
      })),
    );

    expect(response.status).toBe(200);
    expect(dispatchHits).toHaveLength(1);
  });

  it("rejects unknown workflow identifiers that are not allowlisted aliases/files", async () => {
    const authToken = makeJwt({ role: "build_admin", sub: "verified-subject" });

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "verified-user-id", role: "authenticated" }), { status: 200 });
      }
      if (url.includes("/rest/v1/rpc/enforce_edge_rate_limit")) {
        return new Response(JSON.stringify([{ allowed: true, current_count: 1 }]), { status: 200 });
      }
      return new Response("not-found", { status: 404 });
    }) as typeof fetch;

    const handler = loadDispatchHandler();
    const response = await withEnv(
      {
        ENVIRONMENT: "development",
        K1W1_EDGE_WORKFLOW_ADMIN_KEY: "admin-secret",
        K1W1_SUPABASE_URL: "https://example.supabase.co",
        K1W1_SUPABASE_SERVICE_ROLE_KEY: "service-role",
        GITHUB_TOKEN: "gh-token",
        K1W1_ALLOWED_GITHUB_REPOS: "owner/repo",
        K1W1_ALLOWED_REF_REGEX: "^(main)$",
        K1W1_TRUSTED_PROXY_HOPS: "1",
      },
      () => handler(new Request("http://localhost/github-workflow-dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authToken}`,
          "x-forwarded-for": "198.51.100.20, 10.0.0.1",
        },
        body: JSON.stringify({
          githubRepo: "owner/repo",
          workflow: "totally-unknown-workflow.yml",
          ref: "main",
        }),
      })),
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("missing_workflow");
  });

  it("rejects numeric workflow identifiers to close ID-based allowlist bypass", async () => {
    const authToken = makeJwt({ role: "build_admin", sub: "verified-subject" });

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "verified-user-id", role: "authenticated" }), { status: 200 });
      }
      if (url.includes("/rest/v1/rpc/enforce_edge_rate_limit")) {
        return new Response(JSON.stringify([{ allowed: true, current_count: 1 }]), { status: 200 });
      }
      if (url.includes("/actions/workflows/123456789/dispatches")) {
        throw new Error("numeric workflow dispatch URL should never be called");
      }
      return new Response("not-found", { status: 404 });
    }) as typeof fetch;

    const handler = loadDispatchHandler();
    const response = await withEnv(
      {
        ENVIRONMENT: "development",
        K1W1_EDGE_WORKFLOW_ADMIN_KEY: "admin-secret",
        K1W1_SUPABASE_URL: "https://example.supabase.co",
        K1W1_SUPABASE_SERVICE_ROLE_KEY: "service-role",
        GITHUB_TOKEN: "gh-token",
        K1W1_ALLOWED_GITHUB_REPOS: "owner/repo",
        K1W1_ALLOWED_REF_REGEX: "^(main)$",
        K1W1_TRUSTED_PROXY_HOPS: "1",
      },
      () => handler(new Request("http://localhost/github-workflow-dispatch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authToken}`,
          "x-forwarded-for": "198.51.100.20, 10.0.0.1",
        },
        body: JSON.stringify({
          githubRepo: "owner/repo",
          workflow: "123456789",
          ref: "main",
        }),
      })),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain("disallowed_workflow_identifier");
  });
});
