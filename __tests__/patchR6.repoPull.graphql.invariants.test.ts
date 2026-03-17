import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("R6 repo pull invariants", () => {
  it("uses GraphQL batch blob resolution with REST blob fallback", () => {
    const src = read("hooks/useGitHubRepos.ts");

    expect(src).toContain('githubApiUrl("/graphql")');
    expect(src).toContain("object(expression:");
    expect(src).toContain("/git/blobs/");
  });

  it("no longer uses per-file contents API in pull flow", () => {
    const src = read("hooks/useGitHubRepos.ts");

    expect(src).not.toContain("/contents/");
  });
});
