import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch801 prod refs and deploy hygiene invariants", () => {
  it("keeps edge smoke test fail-closed for missing EDGE_BASE_URL", () => {
    const smoke = read("scripts/edge-fn-smoke-test.sh");

    expect(smoke).toContain('BASE_URL="${EDGE_BASE_URL:-}"');
    expect(smoke).toContain('EDGE_BASE_URL fehlt.');
    expect(smoke).toContain("^https://[a-z0-9-]+\\.supabase\\.co/functions/v1/?$");
    expect(smoke).not.toContain("^https://[^[:space:]]+/functions/v1/?$");
  });

  it("keeps live env examples and runbooks neutral (no hardcoded live ref)", () => {
    const envExample = read(".env.edge.live.example");
    const setupRunbook = read("docs/runbooks/OPERATOR_SETUP_CHECKLIST.md");
    const execRunbook = read("docs/runbooks/OPERATOR_EXECUTION_CHECKLIST.md");

    expect(envExample).toContain("<your-project-ref>");
    expect(envExample).not.toContain("xfgnzpcljsuqqdjlxgul");
    expect(setupRunbook).not.toContain("xfgnzpcljsuqqdjlxgul");
    expect(execRunbook).not.toContain("xfgnzpcljsuqqdjlxgul");
  });

  it("keeps eas-project.json free from real production project IDs", () => {
    const easProject = read("eas-project.json");

    expect(easProject).toContain('"projectId": "__UNLINKED_EAS_PROJECT_ID__"');
    expect(easProject).not.toContain("5e5a7791-8751-416b-9a1f-831adfffcb6c");
  });
});
