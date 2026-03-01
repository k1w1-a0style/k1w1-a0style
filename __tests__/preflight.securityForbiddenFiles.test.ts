import { checkForbiddenFiles } from "../lib/diagnostics/checks/assetsAndFiles";

describe("preflight security-forbidden-files", () => {
  it("fails for keystore path and private key content without autofix", () => {
    const result = checkForbiddenFiles.run([
      { path: "android/app/release.keystore", content: "binary" } as any,
      { path: "secrets/dev.txt", content: "-----BEGIN PRIVATE KEY-----\nabc" } as any,
    ], { mode: "eas", profile: "all" });

    expect(result.id).toBe("security-forbidden-files");
    expect(result.status).toBe("fail");
    expect(result.fix).toBeUndefined();
    expect((result.details ?? []).join("\n")).toMatch(/release\.keystore|BEGIN PRIVATE KEY|Private Keys/i);
  });
});
