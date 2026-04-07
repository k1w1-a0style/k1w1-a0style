import fs from "fs";
import path from "path";

describe("eas-build writeback ref guard", () => {
  it("keeps writeback regex scoped away from main and allows codex/work branches", () => {
    const src = fs.readFileSync(path.join(process.cwd(), ".github/workflows/eas-build.yml"), "utf8");
    expect(src).toContain('ALLOWED_REF_REGEX: "^(work|codex|dev|develop|release/.+|feature/.+|hotfix/.+)$"');
    expect(src).not.toContain('ALLOWED_REF_REGEX: "^(work|main|dev|develop|release/.+|feature/.+|hotfix/.+)$"');
  });
});
