import { getRequestClientIp, getRequestRateLimitSubject } from "../supabase/functions/_shared/auth";

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

  it("falls back to canonical client ip", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "198.51.100.8:443, 10.0.0.1",
      },
    });

    expect(getRequestClientIp(req)).toBe("198.51.100.8");
    expect(getRequestRateLimitSubject(req)).toBe("ip:198.51.100.8");
  });

  it("rejects invalid spoofed forwarded values", () => {
    const req = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "evil.example.com",
      },
    });

    expect(getRequestClientIp(req)).toBe("unknown");
    expect(getRequestRateLimitSubject(req)).toBe("ip:unknown");
  });
});
