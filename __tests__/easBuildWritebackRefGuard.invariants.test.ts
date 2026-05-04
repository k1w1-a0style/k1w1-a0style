import fs from "fs";
import path from "path";

describe("eas-build writeback ref guard", () => {
  it("does not hardcode operational branch regexes in eas-build autofix", () => {
    const src = fs.readFileSync(path.join(process.cwd(), ".github/workflows/eas-build.yml"), "utf8");
    expect(src).not.toContain("ALLOWED_REF_REGEX");
    expect(src).not.toContain("work|codex|dev|develop");
  });

  it("does not hardcode operational branch regexes in eas-link", () => {
    const src = fs.readFileSync(path.join(process.cwd(), ".github/workflows/eas-link.yml"), "utf8");
    expect(src).not.toContain("work|codex|dev|develop");
  });
});
