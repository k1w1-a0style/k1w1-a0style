import { checkLockfileConsistency } from "../lib/diagnostics/checks/assetsAndFiles";
import { makeProjectFile } from "./helpers/projectTestHelpers";

describe("preflight lockfile-consistency", () => {
  it("keeps .npmrc package-lock=false warning manual-only without autofix patch", () => {
    const result = checkLockfileConsistency.run(
      [
        makeProjectFile("package.json", "{}"),
        makeProjectFile(".npmrc", "package-lock=false\nsave-exact=true\n"),
      ],
      { mode: "eas", profile: "all" },
    );

    expect(result.id).toBe("lockfile-consistency");
    expect(result.status).toBe("warn");
    expect(result.message).toContain("ownership-geschützt");
    expect(result.fix).toBeUndefined();
    expect(result.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Manueller Schritt"),
        expect.stringContaining("bewusst deaktiviert"),
      ]),
    );
  });

  it("keeps missing-lockfile guidance manual-only for .npmrc creation", () => {
    const result = checkLockfileConsistency.run([makeProjectFile("package.json", "{}")], {
      mode: "eas",
      profile: "all",
    });

    expect(result.id).toBe("lockfile-consistency");
    expect(result.status).toBe("warn");
    expect(result.message).toContain("nicht per local Autofix");
    expect(result.fix).toBeUndefined();
    expect(result.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining(".npmrc"),
        expect.stringContaining("Lockfile"),
      ]),
    );
  });

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
