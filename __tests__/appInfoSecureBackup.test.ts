import {
  createConfigAndSecretsBackupPayload,
  createSecretBackupPayload,
  decryptScopedBackup,
  encryptScopedBackup,
  secureBackupContainsProjectContent,
  validateEncryptedScopedBackupJson,
} from "../lib/appInfoScopedBackup";
import { sanitizeAiConfigFromBackup, validateApiBackupJson } from "../lib/appInfoBackup";

const baseConfig: any = {
  version: 1,
  selectedChatProvider: "openai",
  selectedChatMode: "gpt-4.1-mini",
  selectedAgentProvider: "anthropic",
  selectedAgentMode: "claude-sonnet-4-20250514",
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
      edgeAdminKey: "edge_admin_secret",
      signingMasterKey: "signing_master_secret",
    },
    ciSecrets: {
      EXPO_TOKEN: "expo_secret_token",
      SIGNING_MASTER_KEY: "signing_master_secret",
    },
    github: {
      activeRepo: "owner/repo",
      activeBranch: "main",
      recentRepos: ["owner/repo", "owner/other"],
    },
  });
}

describe("app info secure backup contract", () => {
  test("encrypted secret backup is not plaintext JSON and round-trips with the right passphrase", async () => {
    const payload = makeSecretPayload();
    const encrypted = await encryptScopedBackup({
      scope: "secrets",
      passphrase: "123456",
      appVersion: "1.0.0",
      payload,
    });

    const serialized = JSON.stringify(encrypted);
    expect(serialized).toContain('"type":"k1w1-secure-backup"');
    expect(serialized).not.toContain("ghp_secret_token");
    expect(serialized).not.toContain("expo_secret_token");
    expect(serialized).not.toContain("supabase.co\nANON=abc");

    const restored = await decryptScopedBackup({ passphrase: "123456", backup: encrypted });
    expect(restored).toEqual(payload);
  });

  test("wrong passphrase fails cleanly", async () => {
    const encrypted = await encryptScopedBackup({
      scope: "secrets",
      passphrase: "correct-pass",
      appVersion: "1.0.0",
      payload: makeSecretPayload(),
    });

    await expect(
      decryptScopedBackup({ passphrase: "wrong-pass", backup: encrypted }),
    ).rejects.toThrow("Backup konnte nicht entschlüsselt werden");
  });

  test("damaged encrypted backup fails validation/import cleanly", async () => {
    const encrypted = await encryptScopedBackup({
      scope: "secrets",
      passphrase: "correct-pass",
      appVersion: "1.0.0",
      payload: makeSecretPayload(),
    });

    const damaged = {
      ...encrypted,
      ciphertextBase64: `${encrypted.ciphertextBase64.slice(0, -4)}AAAA`,
    };

    await expect(
      decryptScopedBackup({ passphrase: "correct-pass", backup: damaged }),
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
      passphrase: "123456",
      appVersion: "1.0.0",
      payload: combined,
    });

    const restored = await decryptScopedBackup({ passphrase: "123456", backup: encrypted });
    expect(restored.kind).toBe("config-secret-snapshot");
    expect((restored as any).aiConfig.apiKeys.openai).toEqual(["sk-live-openai"]);
    expect((restored as any).secrets.tokens.githubToken).toBe("ghp_secret_token");
  });

  test("legacy plaintext full backups are rejected explicitly", () => {
    expect(() =>
      validateEncryptedScopedBackupJson({
        type: "k1w1-full-backup",
        version: 1,
      }),
    ).toThrow("Legacy-Klartext-Backups werden nicht mehr unterstützt");
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
