import { checkLockfileConsistency } from "../lib/diagnostics/checks/assetsAndFiles";

describe("preflight lockfile-consistency", () => {
  it("warns for multiple lockfiles and proposes delete patch", () => {
    const result = checkLockfileConsistency.run([
      { path: "package.json", content: "{}" } as any,
      { path: "yarn.lock", content: "yarn" } as any,
      { path: "package-lock.json", content: "npm" } as any,
    ], { mode: "eas", profile: "all" });

    expect(result.id).toBe("lockfile-consistency");
    expect(result.status).toBe("warn");
    expect(result.fix?.patch?.delete?.length ?? 0).toBeGreaterThan(0);
    expect(result.fix?.patch?.delete).toContain("yarn.lock");
  });
});
