import {
  createConfigAndSecretsBackupPayload,
  createSecretBackupPayload,
  decryptScopedBackup,
  encryptScopedBackup,
  secureBackupContainsProjectContent,
  validateSecureBackupPayload,
  validateEncryptedScopedBackupJson,
} from "../lib/appInfoScopedBackup";
import type { AIConfig } from "../contexts/AIContext";
import { sanitizeAiConfigFromBackup, validateApiBackupJson } from "../lib/appInfoBackup";

const baseConfig: AIConfig = {
  version: 1,
  selectedChatProvider: "openai",
  selectedChatMode: "gpt-5.4-mini",
  selectedAgentProvider: "anthropic",
  selectedAgentMode: "claude-4-opus-202502",
  qualityMode: "balanced",
  agentEnabled: true,
  apiKeys: {
    groq: [],
    gemini: [],
    openai: ["sk-live-openai"],
    anthropic: [],
    huggingface: [],
  },
};

beforeAll(() => {
  if (!global.crypto?.subtle) {
    Object.defineProperty(global, "crypto", {
      value: require("crypto").webcrypto,
      configurable: true,
    });
  }
});

function makeSecretPayload() {
  return createSecretBackupPayload({
    exportDate: "2026-03-20T12:00:00.000Z",
    connections: {
      supabaseRaw: "https://example.supabase.co\nANON=abc",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "sb-anon",
      easProjectId: "project-123",
    },
    tokens: {
      githubToken: "ghp_secret_token",
      expoToken: "expo_secret_token",
      workflowAdminKey: "workflow_admin_secret",
      androidKeystoreExportAdminKey: "keystore_export_admin_secret",
      legacyEdgeAdminKey: null,
      signingAdminKey: "signing_admin_secret",
      signingMasterKey: "signing_master_secret",
    },
    ciSecrets: {
      EXPO_TOKEN: "expo_secret_token",
      SIGNING_MASTER_KEY: "signing_master_secret",
    },
    github: {
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      recentRepos: ["owner/repo", "owner/other"],
    },
  });
}

describe("app info secure backup contract", () => {
  test("new secret backups no longer emit deprecated edgeAdminKey snapshots", () => {
    const payload = makeSecretPayload();
    expect(Object.prototype.hasOwnProperty.call(payload.tokens, "edgeAdminKey")).toBe(false);
    expect(payload.tokens.legacyEdgeAdminKey).toBeNull();
  });

  test("encrypted secret backup is not plaintext JSON and round-trips with the right passphrase", async () => {
    const payload = makeSecretPayload();
    const encrypted = await encryptScopedBackup({
      scope: "secrets",
      passphrase: "correct-horse",
      appVersion: "1.0.0",
      payload,
    });

    const serialized = JSON.stringify(encrypted);
    expect(serialized).toContain('"type":"k1w1-secure-backup"');
    expect(serialized).not.toContain("ghp_secret_token");
    expect(serialized).not.toContain("expo_secret_token");
    expect(serialized).not.toContain("supabase.co\nANON=abc");

    const restored = await decryptScopedBackup({ passphrase: "correct-horse", backup: encrypted });
    expect(restored).toEqual(payload);
  });


  test("short passphrases are rejected before encryption", async () => {
    await expect(
      encryptScopedBackup({
        scope: "secrets",
        passphrase: "123456",
        appVersion: "1.0.0",
        payload: makeSecretPayload(),
      }),
    ).rejects.toThrow("starke Passphrase");
  });

  test("wrong passphrase fails cleanly", async () => {
    const encrypted = await encryptScopedBackup({
      scope: "secrets",
      passphrase: "correct-passphrase",
      appVersion: "1.0.0",
      payload: makeSecretPayload(),
    });

    await expect(
      decryptScopedBackup({ passphrase: "wrong-passphrase", backup: encrypted }),
    ).rejects.toThrow("Backup konnte nicht entschlüsselt werden");
  });

  test("damaged encrypted backup fails validation/import cleanly", async () => {
    const encrypted = await encryptScopedBackup({
      scope: "secrets",
      passphrase: "correct-passphrase",
      appVersion: "1.0.0",
      payload: makeSecretPayload(),
    });

    const damaged = {
      ...encrypted,
      ciphertextBase64: `${encrypted.ciphertextBase64.slice(0, -4)}AAAA`,
    };

    await expect(
      decryptScopedBackup({ passphrase: "correct-passphrase", backup: damaged }),
    ).rejects.toThrow("Backup konnte nicht entschlüsselt werden");
  });

  test("secure backup scope excludes project files and chats", async () => {
    const payload = makeSecretPayload();
    expect(secureBackupContainsProjectContent(payload)).toBe(false);
    expect(
      secureBackupContainsProjectContent({
        ...payload,
        files: [{ path: "App.tsx", content: "export default function App(){}" }],
      }),
    ).toBe(true);
  });

  test("config-secrets backup keeps ai config separate from secret-only scope", async () => {
    const secrets = makeSecretPayload();
    const combined = createConfigAndSecretsBackupPayload({ aiConfig: baseConfig, secrets });
    const encrypted = await encryptScopedBackup({
      scope: "config-secrets",
      passphrase: "correct-horse",
      appVersion: "1.0.0",
      payload: combined,
    });

    const restored = await decryptScopedBackup({ passphrase: "correct-horse", backup: encrypted });
    expect(restored.kind).toBe("config-secret-snapshot");
    if (restored.kind !== "config-secret-snapshot") {
      throw new Error("Expected config-secret snapshot payload");
    }
    expect(restored.aiConfig.apiKeys.openai).toEqual(["sk-live-openai"]);
    expect(restored.secrets.tokens.githubToken).toBe("ghp_secret_token");
  });

  test("legacy plaintext full backups are rejected explicitly", () => {
    expect(() =>
      validateEncryptedScopedBackupJson({
        type: "k1w1-full-backup",
        version: 1,
      }),
    ).toThrow("Legacy-Klartext-Backups werden nicht mehr unterstützt");
  });

  test("legacy github activeRepo/activeBranch fields are migrated to linkedRepo/linkedBranch on import", () => {
    const restored = validateSecureBackupPayload({
      kind: "secret-snapshot",
      version: 1,
      exportDate: "2026-03-20T12:00:00.000Z",
      connections: {
        supabaseRaw: "",
        supabaseUrl: "",
        supabaseAnonKey: "",
        easProjectId: "",
      },
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
      github: {
        activeRepo: "legacy/only",
        activeBranch: "legacy-branch",
        recentRepos: ["legacy/only"],
      },
    });

    expect(restored.kind).toBe("secret-snapshot");
    if (restored.kind !== "secret-snapshot") {
      throw new Error("Expected secret snapshot payload");
    }
    expect(restored.github.linkedRepo).toBe("legacy/only");
    expect(restored.github.linkedBranch).toBe("legacy-branch");
  });

  test("legacy edgeAdminKey-only backups migrate compatibly but do not mirror into keystore/signing slots", () => {
    const restored = validateSecureBackupPayload({
      kind: "secret-snapshot",
      version: 1,
      exportDate: "2026-03-20T12:00:00.000Z",
      connections: {
        supabaseRaw: "",
        supabaseUrl: "",
        supabaseAnonKey: "",
        easProjectId: "",
      },
      tokens: {
        githubToken: null,
        expoToken: null,
        edgeAdminKey: "legacy-edge-only",
        workflowAdminKey: null,
        androidKeystoreExportAdminKey: null,
        legacyEdgeAdminKey: null,
        signingAdminKey: null,
        signingMasterKey: null,
      },
      ciSecrets: {},
      github: {
        linkedRepo: "legacy/only",
        linkedBranch: "legacy-branch",
        recentRepos: [],
      },
    });

    if (restored.kind !== "secret-snapshot") {
      throw new Error("Expected secret snapshot payload");
    }

    expect(restored.tokens.workflowAdminKey).toBe("legacy-edge-only");
    expect(restored.tokens.legacyEdgeAdminKey).toBe("legacy-edge-only");
    expect(restored.tokens.androidKeystoreExportAdminKey).toBeNull();
    expect(restored.tokens.signingAdminKey).toBeNull();
  });

  test("config-secret backups sanitize malformed aiConfig instead of trusting raw payloads", () => {
    const restored = validateSecureBackupPayload({
      kind: "config-secret-snapshot",
      version: 1,
      exportDate: "2026-03-20T12:00:00.000Z",
      aiConfig: {
        selectedChatProvider: "totally-not-a-provider",
        selectedChatMode: 123,
        selectedAgentProvider: "anthropic",
        selectedAgentMode: null,
        qualityMode: "best",
        agentEnabled: "yes",
        apiKeys: {
          openai: ["  sk-live-openai  ", "sk-live-openai"],
          gemini: [42],
        },
      },
      secrets: makeSecretPayload(),
    });

    expect(restored.kind).toBe("config-secret-snapshot");
    if (restored.kind !== "config-secret-snapshot") {
      throw new Error("Expected config-secret snapshot payload");
    }

    expect(restored.aiConfig.selectedChatProvider).toBe(baseConfig.selectedChatProvider);
    expect(restored.aiConfig.selectedAgentProvider).toBe("anthropic");
    expect(restored.aiConfig.selectedChatMode).toBe(baseConfig.selectedChatMode);
    expect(restored.aiConfig.selectedAgentMode).toBe(baseConfig.selectedAgentMode);
    expect(restored.aiConfig.agentEnabled).toBe(true);
    expect(restored.aiConfig.qualityMode).toBe("quality");
    expect(restored.aiConfig.apiKeys.openai).toEqual(["sk-live-openai"]);
    expect(restored.aiConfig.apiKeys.gemini).toEqual([]);
  });

  test("legacy api config exports still validate and sanitize independently", () => {
    const validated = validateApiBackupJson({
      version: 1,
      exportDate: "2026-03-20T12:00:00.000Z",
      config: {
        ...baseConfig,
        apiKeys: {
          ...baseConfig.apiKeys,
          openai: ["  sk-live-openai  ", "sk-live-openai"],
        },
      },
    });

    const sanitized = sanitizeAiConfigFromBackup(validated.config, baseConfig);
    expect(sanitized.apiKeys.openai).toEqual(["sk-live-openai"]);
  });
});
