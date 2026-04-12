import { getRequestClientIp, getRequestRateLimitSubject } from "../supabase/functions/_shared/auth";

function withEnv<T>(patch: Record<string, string | undefined>, run: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(patch)) {
    prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("auth rate limit subject helpers", () => {
  it("uses canonical client ip even when a JWT is present", () => {
    const req = new Request("https://example.test", {
      headers: {
        Authorization: "Bearer xxx." + btoa(JSON.stringify({ sub: "user-123" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") + ".sig",
        "cf-connecting-ip": "203.0.113.9",
      },
    });

    expect(getRequestRateLimitSubject(req)).toBe("ip:203.0.113.9");
  });

  it("does not trust x-forwarded-for without an explicit trusted proxy boundary", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "198.51.100.8:443, 10.0.0.1",
      },
    });

    expect(getRequestClientIp(req)).toBe("unknown");
    expect(getRequestRateLimitSubject(req)).toBe("ip:unknown");
  });

  it("does not trust a client-provided trusted-proxy marker", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-k1w1-trusted-proxy": "1",
        "x-forwarded-for": "198.51.100.8:443, 10.0.0.1",
      },
    });

    expect(getRequestClientIp(req)).toBe("unknown");
    expect(getRequestRateLimitSubject(req)).toBe("ip:unknown");
  });

  it("trusts x-forwarded-for only when trusted proxy hops are configured server-side", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "198.51.100.8:443, 10.0.0.1",
      },
    });

    const trustedIp = withEnv({ K1W1_TRUSTED_PROXY_HOPS: "1" }, () => getRequestClientIp(req));
    expect(trustedIp).toBe("198.51.100.8");
    const trustedSubject = withEnv({ K1W1_TRUSTED_PROXY_HOPS: "1" }, () => getRequestRateLimitSubject(req));
    expect(trustedSubject).toBe("ip:198.51.100.8");
  });

  it("degrades safely when trusted proxy hops are misconfigured", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "198.51.100.8:443, 10.0.0.1",
      },
    });

    const ip = withEnv({ K1W1_TRUSTED_PROXY_HOPS: "abc" }, () => getRequestClientIp(req));
    expect(ip).toBe("unknown");
  });
});
