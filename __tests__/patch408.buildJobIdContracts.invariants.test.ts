import fs from "fs";
import path from "path";

describe("Patch 408 build job id contracts", () => {
  test("buildStartService accepts numeric job ids and no longer requires UUID", () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), "project/services/buildStartService.ts"),
      "utf8",
    );

    expect(file).toContain("function normalizeBuildJobId");
    expect(file).toContain("typeof raw === \"number\"");
    expect(file).toContain('/^[1-9]\\d*$/.test(trimmed)');
    expect(file).not.toContain("UUID erwartet");
    expect(file).not.toContain("function isUuid");
  });

  test("edge validation expects a positive integer build job id", () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/_shared/validation.ts"),
      "utf8",
    );

    expect(file).toContain("jobId must be a positive integer id");
    expect(file).toContain('typeof rawJobId === "number"');
    expect(file).toContain('/^[1-9]\\d*$/.test(trimmed)');
    expect(file).not.toContain("jobId must be a UUID");
  });

  test("product docs no longer promise a UUID job id", () => {
    const docs = fs.readFileSync(
      path.join(process.cwd(), "docs/10-product-and-flows.md"),
      "utf8",
    );
    expect(docs).toContain("positive numerische `jobId`");
    expect(docs).not.toContain("jobId` (UUID)");
  });
});
