import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("high-risk/public edge routes use durable rate limits before local fallbacks", () => {
  it("wires durable + local rate limits for k1w1-handler", () => {
    const src = read("supabase/functions/k1w1-handler/index.ts");
    expect(src).toContain('requireDurableRateLimit(req, {');
    expect(src).toContain('scope: "k1w1-handler"');
    expect(src).toContain("enforceDurable: true");
    expect(src).toContain("getRequestRateLimitSubject(req, jwtActorGuard.actor)");
    expect(src).toContain('rateLimit(req, "k1w1-handler", 20, 60_000, rateLimitSubject)');
  });

  it("wires durable + local rate limits for preview_page", () => {
    const src = read("supabase/functions/preview_page/index.ts");
    expect(src).toContain('requireDurableRateLimit(req, {');
    expect(src).toContain('scope: "preview_page"');
    expect(src).toContain("subject: getRequestRateLimitSubject(req)");
    expect(src).toContain("enforceDurable: true");
    expect(src).toContain('rateLimit(req, "preview_page", 60, 60_000)');
  });

  it("keeps android-keystore-export durable limiter fail-closed", () => {
    const src = read("supabase/functions/android-keystore-export/index.ts");
    expect(src).toContain('requireDurableRateLimit(req, {');
    expect(src).toContain('scope: "android-keystore-export"');
    expect(src).toContain("enforceDurable: true");
    expect(src).toContain("getRequestRateLimitSubject(req, auth.actor)");
    expect(src).toContain('rateLimit(req, "android-keystore-export", 30, 60_000, rateLimitSubject)');
  });
});
