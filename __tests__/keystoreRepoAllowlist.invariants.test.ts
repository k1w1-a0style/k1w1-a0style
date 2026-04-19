import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("keystore routes enforce repo allowlist + durable fail-closed", () => {
  const routes = [
    "supabase/functions/android-keystore-generate/index.ts",
    "supabase/functions/android-keystore-status/index.ts",
    "supabase/functions/android-keystore-export/index.ts",
  ] as const;

  it.each(routes)("%s checks K1W1_ALLOWED_GITHUB_REPOS via isAllowedGithubRepo", (route) => {
    const src = read(route);
    expect(src).toContain("isAllowedGithubRepo");
    expect(src).toContain('return errorResponse("Repo not allowed", req, 403, { repo })');
  });

  it.each(routes)("%s sets enforceDurable=true", (route) => {
    const src = read(route);
    expect(src).toContain("enforceDurable: true");
  });

  it("status + generate final catch keep internal errors sanitized and do not return raw e.message", () => {
    const statusSrc = read("supabase/functions/android-keystore-status/index.ts");
    const generateSrc = read("supabase/functions/android-keystore-generate/index.ts");

    for (const src of [statusSrc, generateSrc]) {
      expect(src).toContain("sanitizeErrorText");
      expect(src).toContain('return errorResponse("Unhandled error", req, 500, { code: "internal_error" });');
      expect(src).not.toContain("message: e instanceof Error ? e.message : String(e)");
    }
  });
});
