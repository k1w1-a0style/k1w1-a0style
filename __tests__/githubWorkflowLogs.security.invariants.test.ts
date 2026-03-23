import fs from "fs";
import path from "path";

describe("github workflow logs security invariants", () => {
  it("does not leak the signed logs download URL in timeout messages", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/github-workflow-logs/helpers.ts"),
      "utf8",
    );

    expect(src).toContain('timeoutMessage: "GitHub logs archive download timed out after 15000ms"');
    expect(src).not.toContain('timeoutMessage: `GitHub logs archive download timed out after 15000ms: ${safeLoc}`');
  });
});
