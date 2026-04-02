import { objectFieldCastSnippet } from "./helpers/invariantSnippetHelpers";
import { readRepoText } from "./helpers/repoSourceHelpers";

describe("CI Lite Patch sync invariants", () => {
  it("stabilizes syncPatchToGitHub via useCallback and removes any-casts for push/sync payload", () => {
    const src = readRepoText("components/CiLiteHeaderButton/hooks/useCiLitePatch.ts");

    expect(src).toContain("const syncPatchToGitHub = useCallback(async (");
    expect(src).toContain("const upserts: ProjectFile[]");
    expect(src).toContain("const files: ProjectFile[]");
    expect(src).toContain("pushFilesToRepo(owner, repo, upserts, targetBranch)");
    expect(src).not.toContain(`pushFilesToRepo(owner, repo, ${objectFieldCastSnippet("upserts")}, targetBranch)`);
    expect(src).not.toContain(objectFieldCastSnippet("{ path, content }"));
  });
});
