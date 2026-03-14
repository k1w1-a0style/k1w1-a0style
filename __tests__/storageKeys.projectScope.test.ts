import {
  credKeyForProjectUiMode,
  credKeyForUiMode,
  resolveProjectCredentialScope,
  diagnosticLastOkKeyForSelection,
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


  it("builds branch-scoped diagnostic key for repo + branch", () => {
    expect(
      diagnosticLastOkKeyForSelection({
        linkedRepo: "Owner/Repo ",
        linkedBranch: "feature/x",
      }),
    ).toBe("diagnostic_last_ok::owner%2Frepo::feature%2Fx");
  });

  it("falls back to legacy diagnostic key when repo or branch is missing", () => {
    expect(diagnosticLastOkKeyForSelection({ linkedRepo: "owner/repo", linkedBranch: "" })).toBe(
      "diagnostic_last_ok",
    );
    expect(diagnosticLastOkKeyForSelection({ linkedRepo: "", linkedBranch: "main" })).toBe(
      "diagnostic_last_ok",
    );
  });

});
