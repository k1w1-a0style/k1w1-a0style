import fs from "fs";
import path from "path";

describe("eas-build writeback ref guard", () => {
  it("keeps eas-build autofix writeback regex limited to operational branches only", () => {
    const src = fs.readFileSync(path.join(process.cwd(), ".github/workflows/eas-build.yml"), "utf8");
    expect(src).toContain('ALLOWED_REF_REGEX: "^(work|codex|dev|develop)$"');
    expect(src).not.toContain("feature/.+");
    expect(src).not.toContain("hotfix/.+");
    expect(src).not.toContain("release/.+");
  });

  it("keeps eas-link writeback regex scoped and explicit", () => {
    const src = fs.readFileSync(path.join(process.cwd(), ".github/workflows/eas-link.yml"), "utf8");
    expect(src).toContain("^(work|codex|main|dev|develop)$");
    expect(src).not.toContain("feature/.+");
    expect(src).not.toContain("hotfix/.+");
    expect(src).not.toContain("release/.+");
  });
});
