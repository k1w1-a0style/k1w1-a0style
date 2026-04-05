import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Refactor Wave A decomposition invariants", () => {
  it("keeps GitHub repo screen orchestration split with dedicated CRUD hook", () => {
    const src = read("screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts");
    expect(src).toContain('from "./useGitHubRepoCrud"');
    expect(src).toContain("useGitHubRepoCrud({");
    expect(src).toContain('from "./useGitHubReposPushPull"');
    expect(src).toContain("useGitHubReposPushPull({");
    expect(src).toContain('from "./useGitHubReposDerivedState"');
    expect(src).toContain("useGitHubReposDerivedState({");
    expect(src).toContain('from "./useGitHubReposScreenBootstrap"');
    expect(src).toContain("useGitHubReposScreenBootstrap()");
  });

  it("keeps CI-Lite run lookup state machine extracted into dedicated hook", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    const lookup = read("components/CiLiteHeaderButton/hooks/useCiLiteRunLookupState.ts");

    expect(src).toContain('from "./useCiLiteRunLookupState"');
    expect(src).toContain("useCiLiteRunLookupState()");
    expect(lookup).toContain("lookupGenerationRef.current += 1");
    expect(lookup).toContain("scheduleLookupPoll");
  });
});
