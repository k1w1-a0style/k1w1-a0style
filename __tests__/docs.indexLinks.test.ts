import fs from "fs";
import path from "path";

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("docs index links sanity", () => {
  it("contains canonical links to active docs and archive", () => {
    const index = read("docs/INDEX.md");

    expect(index).toContain("[00-overview.md](00-overview.md)");
    expect(index).toContain("[06-build-readiness.md](06-build-readiness.md)");
    expect(index).toContain("[08-test-coverage-matrix.md](08-test-coverage-matrix.md)");
    expect(index).toContain("[runbooks/APP_RUNBOOK.md](runbooks/APP_RUNBOOK.md)");
    expect(index).toContain("[patches/README.md](patches/README.md)");
  });
});
