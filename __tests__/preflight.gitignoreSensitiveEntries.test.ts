import { checkGitignorePresent } from "../lib/diagnostics/checks/assetsAndFiles";
import { GITIGNORE_TEMPLATE } from "../lib/diagnostics/checks/assetsAndFiles.helpers";
import { makeProjectFile } from "./helpers/preflightTestHelpers";

describe("preflight gitignore sensitive entries", () => {
  it("warns when .npmrc guards are missing", () => {
    const result = checkGitignorePresent.run(
      [makeProjectFile(".gitignore", "node_modules/\n")],
      { mode: "eas", profile: "all" },
    );

    expect(result.id).toBe("gitignore-present");
    expect(result.status).toBe("warn");
    expect(result.details).toEqual(expect.arrayContaining([".npmrc", "**/.npmrc"]));
  });

  it("template includes .npmrc guards", () => {
    expect(GITIGNORE_TEMPLATE).toContain(".npmrc");
    expect(GITIGNORE_TEMPLATE).toContain("**/.npmrc");
  });
});
