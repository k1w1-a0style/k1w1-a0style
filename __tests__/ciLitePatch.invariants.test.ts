import fs from "fs";
import path from "path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("CI Lite Patch sync invariants", () => {
  it("stabilizes syncPatchToGitHub via useCallback and removes any-casts for push/sync payload", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLitePatch.ts");

    expect(src).toContain("const syncPatchToGitHub = useCallback(async (");
    expect(src).toContain("const upserts: ProjectFile[]");
    expect(src).toContain("const files: ProjectFile[]");
    expect(src).toContain("pushFilesToRepo(owner, repo, upserts, targetBranch)");
    expect(src).not.toContain("pushFilesToRepo(owner, repo, upserts as any, targetBranch)");
    expect(src).not.toContain("({ path, content } as any)");
  });
});
