import { __resetLocalRateLimitForTests, rateLimit } from "../supabase/functions/_shared/auth";

describe("local in-memory rateLimit prune window isolation", () => {
  const req = new Request("http://localhost/edge", { headers: { "x-forwarded-for": "1.2.3.4" } });

  beforeEach(() => {
    __resetLocalRateLimitForTests();
    jest.restoreAllMocks();
  });

  it("does not prune long-window buckets when a short-window call triggers cleanup", () => {
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(0);

    expect(rateLimit(req, "short-route", 2, 10_000)).toBeNull();
    expect(rateLimit(req, "long-route", 2, 60_000)).toBeNull();

    nowSpy.mockReturnValue(21_000);
    expect(rateLimit(req, "short-prune-trigger", 2, 10_000)).toBeNull();

    expect(rateLimit(req, "long-route", 2, 60_000)).toBeNull();
    const blocked = rateLimit(req, "long-route", 2, 60_000);
    expect(blocked?.status).toBe(429);
  });

  it("still prunes genuinely stale short-window buckets", () => {
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(0);

    expect(rateLimit(req, "short-route", 1, 10_000)).toBeNull();
    const blockedAtStart = rateLimit(req, "short-route", 1, 10_000);
    expect(blockedAtStart?.status).toBe(429);

    nowSpy.mockReturnValue(21_000);
    expect(rateLimit(req, "prune-trigger", 1, 10_000)).toBeNull();

    // old short-route entry should have been pruned/reset and allow the first hit again.
    expect(rateLimit(req, "short-route", 1, 10_000)).toBeNull();
  });
});
