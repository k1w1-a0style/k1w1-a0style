import {
  getSecureBackupExportSuccessMessage,
  getSecureBackupImportScopeText,
} from "../screens/AppInfoScreen/hooks/appInfoSecureBackupUiHelpers";
import { createConfigAndSecretsBackupPayload, createSecretBackupPayload } from "../lib/appInfoScopedBackup";

describe("appInfoSecureBackupUiHelpers", () => {
  test("export success message stays scope-specific", () => {
    expect(
      getSecureBackupExportSuccessMessage({
        scope: "secrets",
        fileName: "k1w1-secrets-backup-x.json",
      }),
    ).toContain("Keine Projektdateien oder Chats sind enthalten");

    expect(
      getSecureBackupExportSuccessMessage({
        scope: "config-secrets",
        fileName: "k1w1-config-secrets-backup-x.json",
      }),
    ).toContain("AI-/KI-Konfiguration plus Secrets/Connections");
  });

  test("import scope text maps by payload kind", () => {
    const secrets = createSecretBackupPayload({
      connections: { supabaseRaw: "", supabaseUrl: "", supabaseAnonKey: "", easProjectId: "" },
      tokens: {
        githubToken: null,
        expoToken: null,
        workflowAdminKey: null,
        androidKeystoreExportAdminKey: null,
        legacyEdgeAdminKey: null,
        signingAdminKey: null,
        signingMasterKey: null,
      },
      ciSecrets: {},
      github: { linkedRepo: null, linkedBranch: null, recentRepos: [] },
    });

    const configSecrets = createConfigAndSecretsBackupPayload({
      aiConfig: {
        version: 1,
        selectedChatProvider: "groq",
        selectedChatMode: "mode",
        selectedAgentProvider: "anthropic",
        selectedAgentMode: "agent-mode",
        qualityMode: "speed",
        agentEnabled: true,
        apiKeys: { groq: [], gemini: [], openai: [], anthropic: [], huggingface: [] },
      },
      secrets,
    });

    expect(getSecureBackupImportScopeText(secrets)).toBe("Secrets/Tokens/Connections");
    expect(getSecureBackupImportScopeText(configSecrets)).toBe("AI-/KI-Konfiguration plus Secrets/Connections");
  });
});
