import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Buffer } from "buffer";
import {
  createConfigAndSecretsBackupPayload,
  createSecretBackupPayload,
  decryptScopedBackup,
  encryptScopedBackup,
  secureBackupNeedsCryptoUpgrade,
  secureBackupContainsProjectContent,
  validateSecureBackupPayload,
  validateEncryptedScopedBackupJson,
} from "../lib/appInfoScopedBackup";
import type { AIConfig } from "../contexts/AIContext";
import {
  createApiBackupExportPayload,
  mergeApiConfigImportPreservingLocalKeys,
  sanitizeAiConfigFromBackup,
  validateApiBackupJson,
} from "../lib/appInfoBackup";
import {
  clearSecureBackupImportRollbackSnapshot,
  persistSecureBackupImportRollbackSnapshot,
  readSecureBackupImportRollbackSnapshot,
} from "../screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow";

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

beforeEach(() => {
  const storage = AsyncStorage as typeof AsyncStorage & {
    __resetMockStorage?: () => void;
  };
  storage.__resetMockStorage?.();
  const secureStore = SecureStore as typeof SecureStore & {
    __resetMockStorage?: () => void;
    __setMockStorage?: (next: Record<string, string>) => void;
  };
  secureStore.__resetMockStorage?.();
});

async function createEncryptedBackupWithIterations(input: {
  payload: ReturnType<typeof makeSecretPayload>;
  iterations: number;
  passphrase: string;
}) {
  const subtle = global.crypto.subtle;
  const salt = global.crypto.getRandomValues(new Uint8Array(16));
  const iv = global.crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await subtle.importKey("raw", new TextEncoder().encode(input.passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: input.iterations,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const encrypted = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(input.payload)),
  );

  return {
    type: "k1w1-secure-backup" as const,
    version: 1 as const,
    scope: "secrets" as const,
    exportDate: input.payload.exportDate,
    appVersion: "1.0.0",
    encryption: {
      algorithm: "AES-GCM" as const,
      kdf: "PBKDF2-SHA-256" as const,
      iterations: input.iterations,
      saltBase64: Buffer.from(salt).toString("base64"),
      ivBase64: Buffer.from(iv).toString("base64"),
    },
    ciphertextBase64: Buffer.from(new Uint8Array(encrypted)).toString("base64"),
  };
}

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
    expect(restored).toEqual({
      ...payload,
      tokens: {
        ...payload.tokens,
        edgeAdminKey: null,
      },
    });
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

  test("legacy-supported PBKDF2 iteration backups can still be decrypted", async () => {
    const payload = makeSecretPayload();
    const legacyEncrypted = await createEncryptedBackupWithIterations({
      payload,
      iterations: 150000,
      passphrase: "correct-passphrase",
    });

    const validated = validateEncryptedScopedBackupJson(legacyEncrypted);
    const restored = await decryptScopedBackup({ passphrase: "correct-passphrase", backup: validated });
    expect(restored.kind).toBe("secret-snapshot");
    expect(secureBackupNeedsCryptoUpgrade(validated)).toBe(true);
  });

  test("unsupported PBKDF2 iteration counts fail early in backup validation", () => {
    expect(() =>
      validateEncryptedScopedBackupJson({
        type: "k1w1-secure-backup",
        version: 1,
        scope: "secrets",
        exportDate: "2026-03-20T12:00:00.000Z",
        appVersion: "1.0.0",
        encryption: {
          algorithm: "AES-GCM",
          kdf: "PBKDF2-SHA-256",
          iterations: 120000,
          saltBase64: "c2FsdA==",
          ivBase64: "aXY=",
        },
        ciphertextBase64: "Y2lwaGVy",
      }),
    ).toThrow("Ungültiges Backup-Format");
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

    expect(restored.aiConfig.selectedChatProvider).toBe("groq");
    expect(restored.aiConfig.selectedAgentProvider).toBe("anthropic");
    expect(restored.aiConfig.selectedChatMode).toBe("llama-3.1-8b-instant");
    expect(restored.aiConfig.selectedAgentMode).toBe(baseConfig.selectedAgentMode);
    expect(restored.aiConfig.agentEnabled).toBe(true);
    expect(restored.aiConfig.qualityMode).toBe("quality");
    expect(restored.aiConfig.apiKeys.openai).toEqual(["sk-live-openai"]);
    expect(restored.aiConfig.apiKeys.gemini).toEqual([]);
  });

  test("secure backup rollback snapshot round-trips via SecureStore and not via AsyncStorage journal", async () => {
    const snapshot = {
      secrets: makeSecretPayload(),
      derivedStatus: {
        entries: [],
      },
    };
    await persistSecureBackupImportRollbackSnapshot(snapshot);
    const restored = await readSecureBackupImportRollbackSnapshot();

    expect(restored).toEqual(snapshot);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  test("secure backup rollback snapshot helper fails closed for malformed secure payload", async () => {
    const secureStore = SecureStore as typeof SecureStore & {
      __setMockStorage?: (next: Record<string, string>) => void;
    };
    secureStore.__setMockStorage?.({
      secure_backup_import_recoverable_snapshot_v1: "{\"broken\":true}",
    });

    await expect(readSecureBackupImportRollbackSnapshot()).rejects.toThrow("unvollständig");
    await clearSecureBackupImportRollbackSnapshot();
    await expect(readSecureBackupImportRollbackSnapshot()).resolves.toBeNull();
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

  test("api config export payload strips api keys from the exported config", () => {
    const payload = createApiBackupExportPayload({
      config: baseConfig,
      exportDate: "2026-03-20T12:00:00.000Z",
      appVersion: "1.0.0",
    });

    const parsed = validateApiBackupJson(payload);
    const imported = sanitizeAiConfigFromBackup(parsed.config, baseConfig);
    expect(imported.apiKeys.openai).toEqual([]);
    expect(imported.selectedChatProvider).toBe(baseConfig.selectedChatProvider);
    expect(imported.selectedAgentProvider).toBe(baseConfig.selectedAgentProvider);
  });

  test("api config re-import keeps local provider keys when export is redacted", () => {
    const configWithLocalKeys: AIConfig = {
      ...baseConfig,
      apiKeys: {
        ...baseConfig.apiKeys,
        openai: ["local-openai-key"],
        groq: ["local-groq-key"],
      },
    };

    const payload = createApiBackupExportPayload({
      config: configWithLocalKeys,
      exportDate: "2026-03-20T12:00:00.000Z",
      appVersion: "1.0.0",
    });

    const parsed = validateApiBackupJson(payload);
    const imported = mergeApiConfigImportPreservingLocalKeys(parsed.config, configWithLocalKeys);

    expect(imported.apiKeys.openai).toEqual(["local-openai-key"]);
    expect(imported.apiKeys.groq).toEqual(["local-groq-key"]);
  });
});
