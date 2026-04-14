import fs from "fs";
import path from "path";

describe("connections repo marker isolation", () => {
  it("keeps active repo/branch truth on selection SoT instead of CONN_REPO_* markers", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "screens/ConnectionsScreen/hooks/useConnectionsScreen.ts"),
      "utf8",
    );
    expect(src).toContain("resolveRepoBranchSelection");
    expect(src).toContain("const repoLine = selection.repoLine;");
    expect(src).not.toContain("persistence.state.repoOkLine");
    expect(src).not.toContain("persistence.state.repoOk");
  });
});

