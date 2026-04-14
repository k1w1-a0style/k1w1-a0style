import fs from "fs";
import path from "path";

describe("workflow runs loading consistency", () => {
  it("loads the same run history depth that the build UI communicates (10)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "infra/github/workflows.ts"), "utf8");
    expect(src).toContain("runs?per_page=10");
    expect(src).not.toContain("runs?per_page=5");
  });
});

