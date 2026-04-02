import { checkForbiddenFiles } from "../lib/diagnostics/checks/assetsAndFiles";
import { makeProjectFile } from "./helpers/preflightTestHelpers";

describe("preflight security-forbidden-files", () => {
  it("fails for keystore path and private key content without autofix", () => {
    const result = checkForbiddenFiles.run([
      makeProjectFile("android/app/release.keystore", "binary"),
      makeProjectFile("secrets/dev.txt", "-----BEGIN PRIVATE KEY-----\nabc"),
    ], { mode: "eas", profile: "all" });

    expect(result.id).toBe("security-forbidden-files");
    expect(result.status).toBe("fail");
    expect(result.fix).toBeUndefined();
    expect((result.details ?? []).join("\n")).toMatch(/release\.keystore|BEGIN PRIVATE KEY|Private Keys/i);
  });
});
