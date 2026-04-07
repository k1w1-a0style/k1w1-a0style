import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("edge durable rate-limit coverage for sensitive routes", () => {
  it("keeps save_preview behind verified JWT plus durable+local rate limiting", () => {
    const src = read("supabase/functions/save_preview/index.ts");
    expect(src).toContain('requireVerifiedJwt(req, "save_preview")');
    expect(src).toContain('requireDurableRateLimit(req, {');
    expect(src).toContain('scope: "save_preview"');
    expect(src).toContain("enforceDurable: true");
    expect(src).toContain('rateLimit(req, "save_preview")');
  });

  it("keeps android-keystore-status behind durable+local rate limiting", () => {
    const src = read("supabase/functions/android-keystore-status/index.ts");
    expect(src).toContain('requireDurableRateLimit(req, {');
    expect(src).toContain('scope: "android-keystore-status"');
    expect(src).toContain('rateLimit(req, "android-keystore-status", 60, 60_000)');
  });

  it("keeps create_codesandbox disabled as a legacy sunset stub", () => {
    const src = read("supabase/functions/create_codesandbox/index.ts");
    const cfg = read("supabase/config.toml");
    expect(cfg).toContain("[functions.create_codesandbox]");
    expect(cfg).toContain("enabled = false");
    expect(src).toContain('if (req.method === "OPTIONS")');
    expect(src).toContain('status: 410');
    expect(src).toContain('legacy_create_codesandbox_disabled');
    expect(src).not.toContain('requireDurableRateLimit(req, {');
    expect(src).not.toContain('requireScopedEdgeAuth(req, {');
  });
});
