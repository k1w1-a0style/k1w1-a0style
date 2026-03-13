import {
  credKeyForProjectUiMode,
  credKeyForUiMode,
  resolveProjectCredentialScope,
} from "../lib/storageKeys";

describe("storageKeys project credential scope", () => {
  it("prefers project id over linked repo", () => {
    expect(
      resolveProjectCredentialScope({
        projectId: "proj-123",
        linkedRepo: "owner/repo",
      }),
    ).toBe("project:proj-123");
  });

  it("falls back to normalized repo scope when project id is missing", () => {
    expect(
      resolveProjectCredentialScope({
        linkedRepo: "Owner/Repo ",
      }),
    ).toBe("repo:owner/repo");
  });

  it("uses legacy global key when no project scope is available", () => {
    const legacy = credKeyForUiMode("preview");
    expect(
      credKeyForProjectUiMode({
        mode: "preview",
        projectScope: null,
      }),
    ).toBe(legacy);
  });

  it("builds scoped credential key when scope exists", () => {
    expect(
      credKeyForProjectUiMode({
        mode: "dev",
        projectScope: "project:abc-123",
      }),
    ).toBe("cred_key_exists_dev::project%3Aabc-123");
  });
});
