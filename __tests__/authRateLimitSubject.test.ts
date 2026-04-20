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
  it("uses canonical client ip only in trusted Cloudflare proxy context", () => {
    const req = new Request("https://example.test", {
      headers: {
        Authorization: "Bearer xxx." + btoa(JSON.stringify({ sub: "user-123" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") + ".sig",
        "cf-ray": "abc123",
        "cf-connecting-ip": "203.0.113.9",
      },
    });

    const subject = withEnv({ K1W1_TRUST_CF_CONNECTING_IP: "1" }, () => getRequestRateLimitSubject(req));
    expect(subject).toBe("ip:203.0.113.9");
  });

  it("ignores untrusted cf-connecting-ip and degrades to a non-manipulable untrusted subject", () => {
    const req = new Request("https://example.test", {
      headers: {
        "cf-connecting-ip": "203.0.113.9",
      },
    });
    expect(getRequestClientIp(req)).toBe("unknown");
    expect(getRequestRateLimitSubject(req)).toBe("ip:untrusted");
  });

  it("does not trust x-forwarded-for without an explicit trusted proxy boundary", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "198.51.100.8:443, 10.0.0.1",
      },
    });

    expect(getRequestClientIp(req)).toBe("unknown");
    expect(getRequestRateLimitSubject(req)).toBe("ip:untrusted");
  });

  it("does not trust a client-provided trusted-proxy marker", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-k1w1-trusted-proxy": "1",
        "x-forwarded-for": "198.51.100.8:443, 10.0.0.1",
      },
    });

    expect(getRequestClientIp(req)).toBe("unknown");
    expect(getRequestRateLimitSubject(req)).toBe("ip:untrusted");
  });

  it("does not allow header-rotation to create fresh untrusted subjects", () => {
    const reqA = new Request("https://example.test/a", {
      headers: {
        authorization: "Bearer token-a",
        "user-agent": "ua-a",
        "x-forwarded-for": "198.51.100.8, 10.0.0.1",
        "cf-connecting-ip": "203.0.113.5",
      },
    });
    const reqB = new Request("https://example.test/b", {
      headers: {
        authorization: "Bearer token-b",
        "user-agent": "ua-b",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "cf-connecting-ip": "203.0.113.10",
      },
    });

    expect(getRequestClientIp(reqA)).toBe("unknown");
    expect(getRequestClientIp(reqB)).toBe("unknown");
    expect(getRequestRateLimitSubject(reqA)).toBe("ip:untrusted");
    expect(getRequestRateLimitSubject(reqB)).toBe("ip:untrusted");
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

  it("derives client ip from the untrusted edge of the chain based on trusted proxy hops", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "203.0.113.7, 198.51.100.8, 10.0.0.1",
      },
    });

    const ip = withEnv({ K1W1_TRUSTED_PROXY_HOPS: "2" }, () => getRequestClientIp(req));
    expect(ip).toBe("203.0.113.7");
  });

  it("ignores spoofed leftmost x-forwarded-for values when trusted proxy hops are configured", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "198.51.100.200, 198.51.100.8, 10.0.0.1",
      },
    });

    const ip = withEnv({ K1W1_TRUSTED_PROXY_HOPS: "1" }, () => getRequestClientIp(req));
    expect(ip).toBe("198.51.100.8");
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
