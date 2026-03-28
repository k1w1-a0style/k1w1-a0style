import { requireDurableRateLimit, requireJwtRole } from "../supabase/functions/_shared/auth";

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

describe("shared auth fail-closed JWT role guard + durable rate-limit", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("denies unverified JWT payloads even when decoded payload role looks allowed", async () => {
    const token = jwtWithPayload({ role: "service_role", sub: "attacker" });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const fetchSpy = jest.spyOn(globalThis, "fetch" as any).mockResolvedValue(
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
  });

  it("accepts role checks only from verified Supabase auth user response", async () => {
    const token = jwtWithPayload({ role: "anon", sub: "user-1" });
    const req = new Request("http://localhost/edge", {
      headers: { Authorization: `Bearer ${token}` },
    });

    jest.spyOn(globalThis, "fetch" as any).mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1", role: "authenticated" }), { status: 200 }),
    );

    const result = await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srv-key",
      },
      () => requireJwtRole(req, { scope: "test-scope", allowedRoles: ["authenticated"] }),
    );

    expect(result).toBeNull();
  });

  it("uses durable counter storage for high-risk route rate limits", async () => {
    const req = new Request("http://localhost/edge", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const fetchSpy = jest.spyOn(globalThis, "fetch" as any)
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response("[]", {
        status: 200,
        headers: { "content-range": "0-0/4" },
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
    expect(await result?.text()).toContain("rate_limited");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
