import fs from "fs";
import path from "path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("patch 483 GitHubReposScreen step 8 invariants", () => {
  it("ignores stale default-branch lookups after a later repo selection", () => {
    const hook = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");

    expect(hook).toContain("const selectionGen = ++selectRepoGen.current;");
    expect(hook).toContain("if (selectionGen !== selectRepoGen.current) return;");
  });

  it("keeps branch manage modal busy-aware and wired through the screen", () => {
    const hook = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");
    const screen = read("screens/GitHubReposScreen/index.tsx");

    expect(hook).toContain("const [manageBusy, setManageBusy] = useState(false);");
    expect(hook).toContain("const confirmManageModal = useCallback(async () => {");
    expect(screen).toContain("await confirmManageModal();");
    expect(screen).toContain("busy={manageBusy}");
  });

  it("passes typed project files into the diff section without an any-cast", () => {
    const screen = read("screens/GitHubReposScreen/index.tsx");

    expect(screen).toContain("projectFiles={projectFiles}");
    expect(screen).not.toContain("projectFiles={projectFiles as any}");
  });
});
