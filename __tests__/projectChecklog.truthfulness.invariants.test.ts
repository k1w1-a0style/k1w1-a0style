import fs from "fs";
import path from "path";

describe("PROJECT_CHECKLOG truthfulness markers", () => {
  it("states append-only history is not the sole release truth", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "PROJECT_CHECKLOG.md"), "utf8");
    expect(src).toContain("append-only Historie");
    expect(src).toContain("keine** alleinige aktuelle Release-/Freigabe-Wahrheit");
    expect(src).toContain("verify:release");
    expect(src).toContain("docs/TODO.md");
    expect(src).toContain("docs/reviews/Review.md");
  });
});
