import {
  getRequestRateLimitSubject,
  getJwtPayload,
  rateLimit,
  requireDurableRateLimit,
  requireJwtRole,
  requireServiceRoleJwtWithVerifiedActor,
  resolveVerifiedJwtActor,
} from "../supabase/functions/_shared/auth";

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

function jwtWithPayload(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${body}.y`;
}

function jwtWithUtf8Payload(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `x.${body}.y`;
}

describe("shared auth fail-closed JWT role guard + durable rate-limit", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("denies unverified JWT payloads even when decoded payload role looks allowed", async () => {
    const token = jwtWithPayload({ role: "service_role", sub: "attacker" });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid token" }), { status: 401 }),
    );

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireJwtRole(req, { scope: "test-scope", allowedRoles: ["service_role"] }),
    );

    expect(result?.status).toBe(401);
    expect(await result?.text()).toContain("unverifiable JWT");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("falls back to service_role actor when JWT is not verifiable", async () => {
    const token = jwtWithPayload({ role: "service_role", sub: "attacker-sub" });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid token" }), { status: 401 }),
    );

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => resolveVerifiedJwtActor(req, "service_role"),
    );

    expect(result).toEqual({ actor: "service_role", source: "fallback" });
  });

  it("does not trust auth user.role over verified JWT role claims", async () => {
    const token = jwtWithPayload({ role: "anon", sub: "user-1" });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1", role: "authenticated" }), { status: 200 }),
    );

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireJwtRole(req, { scope: "test-scope", allowedRoles: ["authenticated"] }),
    );

    expect(result?.status).toBe(403);
    expect(await result?.text()).toContain("verified JWT role is not allowed");
  });

  it("accepts build_admin from verified JWT claim even when auth user.role is authenticated", async () => {
    const token = jwtWithPayload({
      role: "build_admin",
      app_metadata: { role: "build_admin" },
      sub: "user-2",
    });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: "user-2",
        role: "authenticated",
        app_metadata: { role: "build_admin" },
      }), { status: 200 }),
    );

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireJwtRole(req, { scope: "test-scope", allowedRoles: ["service_role", "build_admin"] }),
    );

    expect(result).toBeNull();
  });

  it("service-role-with-actor guard rejects build_admin on service_role-only routes", async () => {
    const token = jwtWithPayload({ role: "build_admin", sub: "build-admin-sub" });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "build-admin-id", role: "authenticated" }), { status: 200 }),
    );

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireServiceRoleJwtWithVerifiedActor(req, "android-keystore-export"),
    );

    expect(result.guard?.status).toBe(403);
    expect(result.actor).toBeNull();
  });

  it("service-role-with-actor guard returns verified actor for service_role", async () => {
    const token = jwtWithPayload({ role: "service_role", sub: "service-sub" });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "service-role-id", role: "authenticated" }), { status: 200 }),
    );

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireServiceRoleJwtWithVerifiedActor(req, "android-keystore-export"),
    );

    expect(result.guard).toBeNull();
    expect(result.actor).toBe("service-role-id");
  });

  it("keeps utf-8 role decoding intact (would fail on legacy atob+JSON.parse decoder)", async () => {
    const unicodeRole = "build_ädmin";
    const token = jwtWithUtf8Payload({
      role: unicodeRole,
      app_metadata: { role: unicodeRole },
      user_metadata: { display_name: "Jörg 🔒" },
      sub: "user-utf8",
    });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: "user-utf8",
        role: "authenticated",
      }), { status: 200 }),
    );

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireJwtRole(req, { scope: "test-scope", allowedRoles: ["service_role", unicodeRole] }),
    );

    expect(getJwtPayload(req)?.role).toBe(unicodeRole);
    expect(result).toBeNull();
  });


  it("returns 500 when JWT verification server secrets are missing", async () => {
    const token = jwtWithPayload({ role: "authenticated", sub: "user-1" });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await withEnv(
      {
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      },
      () => requireJwtRole(req, { scope: "test-scope", allowedRoles: ["authenticated"] }),
    );

    expect(result?.status).toBe(500);
    expect(await result?.text()).toContain("server auth misconfiguration");
  });




  it("falls back to the local limiter when durable store secrets are missing", async () => {
    const req = new Request("http://localhost/edge", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const result = await withEnv(
      {
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      },
      () => requireDurableRateLimit(req, {
        scope: "trigger-eas-build",
        subject: "1.2.3.4",
        max: 3,
        windowMs: 60_000,
      }),
    );

    expect(result).toBeNull();
  });

  it("fails closed when no trusted rate-limit subject is available", async () => {
    const req = new Request("http://localhost/edge");
    const result = await requireDurableRateLimit(req, {
      scope: "github-workflow-dispatch",
      subject: null,
      max: 20,
      windowMs: 60_000,
    });

    expect(result?.status).toBe(400);
    await expect(result?.text()).resolves.toContain("untrusted_client_ip");
  });

  it("uses the same actor subject contract for durable and local rl paths", async () => {
    const req = new Request("http://localhost/edge");
    const subject = getRequestRateLimitSubject(req, "verified-user-42");
    expect(subject).toBe("actor:verified-user-42");

    const durable = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireDurableRateLimit(req, {
        scope: "github-workflow-dispatch",
        subject,
        max: 20,
        windowMs: 60_000,
      }),
    );

    // fetch is not mocked here; guard we care about is that subject is accepted and doesn't 400.
    expect(durable?.status).not.toBe(400);
    const local = rateLimit(req, "github-workflow-dispatch", 10, 10_000, subject);
    expect(local).toBeNull();
  });

  it("fails closed when durable rate limiting is required but durable secrets are missing", async () => {
    const req = new Request("http://localhost/edge", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const result = await withEnv(
      {
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      },
      () => requireDurableRateLimit(req, {
        scope: "preview_page",
        subject: "1.2.3.4",
        max: 60,
        windowMs: 60_000,
        enforceDurable: true,
      }),
    );

    expect(result?.status).toBe(503);
    await expect(result?.text()).resolves.toContain("rate_limit_unavailable");
  });

  it("falls back to the local limiter when the durable store is temporarily unavailable", async () => {
    const req = new Request("http://localhost/edge", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("durable store offline"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireDurableRateLimit(req, {
        scope: "trigger-eas-build",
        subject: "1.2.3.4",
        max: 3,
        windowMs: 60_000,
      }),
    );

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("falling back to local limiter"),
      expect.objectContaining({
        fallback_mode: "local_in_memory_best_effort",
        cluster_safe: false,
      }),
    );
  });



  it("falls back to the local limiter when durable store write/read respond with HTTP errors", async () => {
    const req = new Request("http://localhost/edge", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rpc boom", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ allowed: true, current_count: 1 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ nope: true }), { status: 200 }));

    const writeResult = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireDurableRateLimit(req, {
        scope: "trigger-eas-build",
        subject: "1.2.3.4",
        max: 3,
        windowMs: 60_000,
      }),
    );

    const successResult = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireDurableRateLimit(req, {
        scope: "trigger-eas-build",
        subject: "1.2.3.4",
        max: 3,
        windowMs: 60_000,
      }),
    );

    const invalidResponseResult = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireDurableRateLimit(req, {
        scope: "trigger-eas-build",
        subject: "1.2.3.4",
        max: 3,
        windowMs: 60_000,
      }),
    );

    expect(writeResult).toBeNull();
    expect(successResult).toBeNull();
    expect(invalidResponseResult).toBeNull();
  });

  it("uses durable counter storage for high-risk route rate limits", async () => {
    const req = new Request("http://localhost/edge", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const fetchSpy = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ allowed: false, current_count: 4, decision: "rejected" }]), {
        status: 200,
      }));

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireDurableRateLimit(req, {
        scope: "trigger-eas-build",
        subject: "1.2.3.4",
        max: 3,
        windowMs: 60_000,
      }),
    );

    expect(result?.status).toBe(429);
    const payload = await result?.json();
    expect(payload).toEqual(expect.objectContaining({
      error: "rate_limited",
      details: expect.objectContaining({ currentCount: 4, decision: "rejected" }),
    }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("accepts single-row array response in strict durable mode without 503", async () => {
    const req = new Request("http://localhost/edge", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ allowed: true, current_count: 2, decision: "allowed" }]), { status: 200 }));

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireDurableRateLimit(req, {
        scope: "k1w1-handler",
        subject: "1.2.3.4",
        max: 3,
        windowMs: 60_000,
        enforceDurable: true,
      }),
    );

    expect(result).toBeNull();
  });

  it("fails closed for invalid durable rpc response shape in strict durable mode", async () => {
    const req = new Request("http://localhost/edge", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ allowed: true }]), { status: 200 }));

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireDurableRateLimit(req, {
        scope: "k1w1-handler",
        subject: "1.2.3.4",
        max: 3,
        windowMs: 60_000,
        enforceDurable: true,
      }),
    );

    expect(result?.status).toBe(503);
    await expect(result?.text()).resolves.toContain("rate_limit_unavailable");
  });
});
