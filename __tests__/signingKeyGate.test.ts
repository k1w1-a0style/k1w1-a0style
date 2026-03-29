import { readSigningKeyGateState } from "../screens/EnhancedBuildScreen/hooks/signingKeyGate";

describe("signing key gate", () => {
  it("reports the local Android Keystore Export Admin Key as the real blocker when no signing key verification exists", async () => {
    const values = new Map<string, string | null>([
      ["cred_key_exists_preview::project%3Aproject-1", null],
      ["cred_key_exists_preview_state::project%3Aproject-1", "auth_error"],
      [
        "cred_key_exists_preview_detail::project%3Aproject-1",
        "Lokaler Android Keystore Export Admin Key wurde vom Edge-Server abgelehnt (401/403). Repo-/Server-Secrets koennen trotzdem vorhanden sein; bitte den lokalen App-Key neu speichern oder korrekt importieren.",
      ],
    ]);

    const result = await readSigningKeyGateState({
      buildProfile: "preview",
      repoFullName: "owner/repo",
      projectData: { id: "project-1" },
      deps: {
        storageGetItem: async (key: string) => values.get(key) ?? null,
        getAndroidKeystoreExportAdminKey: async () => "keystore-admin-key-12345678901234567890",
      },
    });

    expect(result.hasSigningKey).toBe(false);
    expect(result.reason).toMatch(/lokaler android keystore export admin key wurde vom edge-server abgelehnt/i);
  });

  it("reports a missing local Android Keystore Export Admin Key even when repo/server secrets may exist", async () => {
    const result = await readSigningKeyGateState({
      buildProfile: "preview",
      repoFullName: "owner/repo",
      projectData: { id: "project-1" },
      deps: {
        storageGetItem: async () => null,
        getAndroidKeystoreExportAdminKey: async () => null,
      },
    });

    expect(result.hasSigningKey).toBe(false);
    expect(result.reason).toMatch(/lokaler android keystore export admin key fehlt/i);
  });
});
