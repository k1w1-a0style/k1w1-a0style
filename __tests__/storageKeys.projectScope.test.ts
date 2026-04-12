import {
  credKeyForProjectUiMode,
  credKeyForUiMode,
  resolveProjectCredentialScope,
  diagnosticLastOkKeyForSelection,
  diagnosticReadinessRecordKeyForSelection,
  legacyClientServiceRoleStorageKeys,
  STORAGE_KEYS,
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



  it("keeps service-role cleanup on an explicit legacy-only helper instead of normal storage keys", () => {
    expect(Object.prototype.hasOwnProperty.call(STORAGE_KEYS, "SUPABASE_SERVICE_ROLE_KEY")).toBe(false);
    expect(legacyClientServiceRoleStorageKeys()).toEqual(["supabase_service_role_key"]);
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

  it("builds scoped structured diagnostic readiness key for repo + branch", () => {
    expect(
      diagnosticReadinessRecordKeyForSelection({
        linkedRepo: "Owner/Repo ",
        linkedBranch: "feature/x",
      }),
    ).toBe("diagnostic_readiness_record::owner%2Frepo::feature%2Fx");
  });

});
