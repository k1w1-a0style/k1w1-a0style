import fs from "fs";
import path from "path";

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("docs index links sanity", () => {
  it("contains links to 06/07/08/09/10 and runbooks/APP_RUNBOOK.md", () => {
    const index = read("docs/INDEX.md");

    expect(index).toContain("06-build-readiness.md");
    expect(index).toContain("07-diagnostics-fix-playbook.md");
    expect(index).toContain("08-test-coverage-matrix.md");
    expect(index).toContain("09-gap-tickets.md");
    expect(index).toContain("10-product-and-flows.md");
    expect(index).toContain("runbooks/APP_RUNBOOK.md");
  });
});
