import { requireScopedEdgeAuth } from "../supabase/functions/_shared/auth";

function withEnv<T>(patch: Record<string, string | undefined>, run: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("requireScopedEdgeAuth behavior", () => {
  it("fails closed when scoped admin secret is missing", async () => {
    const req = new Request("https://example.test/edge", {
      headers: { "x-k1w1-admin-key": "abc" },
    });

    const res = withEnv({ K1W1_EDGE_WORKFLOW_ADMIN_KEY: undefined }, () =>
      requireScopedEdgeAuth(req, {
        scope: "workflow-test",
        allowAdmin: true,
        adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      }),
    );

    expect(res?.status).toBe(500);
    await expect(res?.text()).resolves.toContain("Missing required auth secrets");
  });

  it("rejects malformed authorization header", async () => {
    const req = new Request("https://example.test/edge", {
      headers: { authorization: "Bearer" },
    });

    const res = withEnv({ K1W1_EDGE_WORKFLOW_ADMIN_KEY: "secret" }, () =>
      requireScopedEdgeAuth(req, {
        scope: "workflow-test",
        allowAdmin: true,
        adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      }),
    );

    expect(res?.status).toBe(401);
    await expect(res?.text()).resolves.toContain("invalid Authorization header format");
  });

  it("accepts mixed bearer+admin header when admin key is valid", () => {
    const req = new Request("https://example.test/edge", {
      headers: {
        authorization: "Bearer token-1",
        "x-k1w1-admin-key": "secret",
      },
    });

    const res = withEnv({ K1W1_EDGE_WORKFLOW_ADMIN_KEY: "secret" }, () =>
      requireScopedEdgeAuth(req, {
        scope: "workflow-test",
        allowAdmin: true,
        adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      }),
    );

    expect(res).toBeNull();
  });

  it("rejects bearer-only auth for scoped admin routes", async () => {
    const req = new Request("https://example.test/edge", {
      headers: {
        authorization: "Bearer token-1",
      },
    });

    const res = withEnv({ K1W1_EDGE_WORKFLOW_ADMIN_KEY: "secret" }, () =>
      requireScopedEdgeAuth(req, {
        scope: "workflow-test",
        allowAdmin: true,
        adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      }),
    );

    expect(res?.status).toBe(401);
    await expect(res?.text()).resolves.toContain("always requires x-k1w1-admin-key");
  });

  it("accepts valid scoped admin key", () => {
    const req = new Request("https://example.test/edge", {
      headers: { "x-k1w1-admin-key": "secret" },
    });

    const res = withEnv({ K1W1_EDGE_WORKFLOW_ADMIN_KEY: "secret" }, () =>
      requireScopedEdgeAuth(req, {
        scope: "workflow-test",
        allowAdmin: true,
        adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      }),
    );

    expect(res).toBeNull();
  });
});
