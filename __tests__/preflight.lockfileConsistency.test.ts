import { checkLockfileConsistency } from "../lib/diagnostics/checks/assetsAndFiles";
import { makeProjectFile } from "./helpers/projectTestHelpers";

describe("preflight lockfile-consistency", () => {
  it("warns for multiple lockfiles and proposes delete patch", () => {
    const result = checkLockfileConsistency.run([
      makeProjectFile("package.json", "{}"),
      makeProjectFile("yarn.lock", "yarn"),
      makeProjectFile("package-lock.json", "npm"),
    ], { mode: "eas", profile: "all" });

    expect(result.id).toBe("lockfile-consistency");
    expect(result.status).toBe("warn");
    expect(result.fix?.patch?.delete?.length ?? 0).toBeGreaterThan(0);
    expect(result.fix?.patch?.delete).toContain("yarn.lock");
  });
});
