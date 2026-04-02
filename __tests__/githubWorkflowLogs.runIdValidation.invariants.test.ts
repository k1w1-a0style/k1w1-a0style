import fs from "node:fs";
import path from "node:path";

describe("github-workflow-logs runId validation contract", () => {
  it("requires runId to be a positive integer", () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/github-workflow-logs/index.ts"),
      "utf8",
    );

    expect(file).toContain("Number.isInteger(runIdRaw)");
    expect(file).toContain("Number(runIdRaw) > 0");
    expect(file).toContain("runId must be a positive integer");
  });
});
