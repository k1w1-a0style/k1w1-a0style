import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("sensitive operator routes apply no-store", () => {
  it("github-workflow-logs helper wraps responses with no-store", () => {
    const src = read("supabase/functions/github-workflow-logs/helpers.ts");
    expect(src).toContain("jsonResponse(body, req, status, { noStore: true })");
    expect(src).toContain("errorResponse(error, req, status, details, { noStore: true })");
  });

  it("github-run-artifact-json uses secure no-store responses", () => {
    const src = read("supabase/functions/github-run-artifact-json/index.ts");
    expect(src).toContain("noStore: true");
    expect(src).toContain("sanitizeErrorText");
    expect(src).toContain('return errorResponse("Unhandled error", req, 500, { code: "internal_error" }, {');
    expect(src).not.toContain("return errorResponse(String(e instanceof Error ? e.message : e), req, 500, undefined, {");
    expect(src).not.toContain("Failed to unzip artifact: ${String(e)}");
  });

  it("android-keystore-export uses secure no-store responses", () => {
    const src = read("supabase/functions/android-keystore-export/index.ts");
    expect(src).toContain("noStore: true");
  });
});
