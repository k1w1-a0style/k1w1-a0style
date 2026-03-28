import { Buffer } from "buffer";

import type { AIConfig } from "../contexts/AIContext";

export const SECURE_BACKUP_VERSION = 1 as const;
export const SECURE_BACKUP_PBKDF2_ITERATIONS = 250000;
const AES_KEY_LENGTH = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export type SecureBackupScope = "secrets" | "config-secrets";

export type SecretConnectionsSnapshotV1 = {
  supabaseRaw: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  easProjectId: string;
};

export type SecretTokensSnapshotV1 = {
  githubToken: string | null;
  expoToken: string | null;
  /** @deprecated legacy compatibility snapshot key */
  edgeAdminKey?: string | null;
  workflowAdminKey: string | null;
  androidKeystoreExportAdminKey: string | null;
  legacyEdgeAdminKey: string | null;
  signingAdminKey: string | null;
  signingMasterKey?: string | null;
};

export type SecretGithubContextSnapshotV1 = {
  activeRepo: string | null;
  activeBranch: string | null;
  recentRepos: string[];
};

export type SecretBackupPayloadV1 = {
  kind: "secret-snapshot";
  version: typeof SECURE_BACKUP_VERSION;
  exportDate: string;
  connections: SecretConnectionsSnapshotV1;
  tokens: SecretTokensSnapshotV1;
  ciSecrets: Record<string, string>;
  github: SecretGithubContextSnapshotV1;
};

export type ConfigAndSecretsBackupPayloadV1 = {
  kind: "config-secret-snapshot";
  version: typeof SECURE_BACKUP_VERSION;
  exportDate: string;
  aiConfig: AIConfig;
  secrets: SecretBackupPayloadV1;
};

export type SecureBackupPayloadV1 =
  | SecretBackupPayloadV1
  | ConfigAndSecretsBackupPayloadV1;

export type EncryptedScopedBackupV1 = {
  type: "k1w1-secure-backup";
  version: typeof SECURE_BACKUP_VERSION;
  scope: SecureBackupScope;
  exportDate: string;
  appVersion: string;
  encryption: {
    algorithm: "AES-GCM";
    kdf: "PBKDF2-SHA-256";
    iterations: number;
    saltBase64: string;
    ivBase64: string;
  };
  ciphertextBase64: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const next = entry.trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function normalizeBufferSource(bytes: Uint8Array): Uint8Array {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Uint8Array(buffer);
}

function toBufferSource(bytes: Uint8Array): BufferSource {
  return normalizeBufferSource(bytes) as unknown as BufferSource;
}

async function getRandomBytes(length: number): Promise<Uint8Array> {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint8Array(length));
  }

  const expoCrypto = await import("expo-crypto");
  return expoCrypto.getRandomBytesAsync(length);
}

function requireSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto/AES-GCM ist auf diesem Gerät nicht verfügbar.");
  }
  return subtle;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = requireSubtleCrypto();
  const passphraseBytes = new TextEncoder().encode(passphrase);
  const baseKey = await subtle.importKey("raw", passphraseBytes, "PBKDF2", false, ["deriveKey"]);

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toBufferSource(salt),
      iterations: SECURE_BACKUP_PBKDF2_ITERATIONS,
    },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

function ensurePassphrase(passphrase: string) {
  if (typeof passphrase !== "string" || passphrase.trim().length < 6) {
    throw new Error("Bitte ein Passwort oder eine PIN mit mindestens 6 Zeichen eingeben.");
  }
}

export function createSecretBackupPayload(input: {
  exportDate?: string;
  connections: SecretConnectionsSnapshotV1;
  tokens: SecretTokensSnapshotV1;
  ciSecrets: Record<string, string>;
  github: SecretGithubContextSnapshotV1;
}): SecretBackupPayloadV1 {
  const exportDate = input.exportDate ?? new Date().toISOString();

  return {
    kind: "secret-snapshot",
    version: SECURE_BACKUP_VERSION,
    exportDate,
    connections: {
      supabaseRaw: normalizeString(input.connections.supabaseRaw),
      supabaseUrl: normalizeString(input.connections.supabaseUrl),
      supabaseAnonKey: normalizeString(input.connections.supabaseAnonKey),
      easProjectId: normalizeString(input.connections.easProjectId),
    },
    tokens: {
      githubToken: normalizeOptionalString(input.tokens.githubToken),
      expoToken: normalizeOptionalString(input.tokens.expoToken),
      edgeAdminKey: normalizeOptionalString(input.tokens.edgeAdminKey),
      workflowAdminKey: normalizeOptionalString(input.tokens.workflowAdminKey),
      androidKeystoreExportAdminKey: normalizeOptionalString(input.tokens.androidKeystoreExportAdminKey),
      legacyEdgeAdminKey: normalizeOptionalString(input.tokens.legacyEdgeAdminKey),
      signingAdminKey: normalizeOptionalString(input.tokens.signingAdminKey),
      signingMasterKey: normalizeOptionalString(input.tokens.signingMasterKey),
    },
    ciSecrets: Object.fromEntries(
      Object.entries(input.ciSecrets ?? {}).map(([key, value]) => [key, normalizeString(value)]),
    ),
    github: {
      activeRepo: normalizeOptionalString(input.github.activeRepo),
      activeBranch: normalizeOptionalString(input.github.activeBranch),
      recentRepos: normalizeStringArray(input.github.recentRepos),
    },
  };
}

export function createConfigAndSecretsBackupPayload(input: {
  aiConfig: AIConfig;
  secrets: SecretBackupPayloadV1;
  exportDate?: string;
}): ConfigAndSecretsBackupPayloadV1 {
  return {
    kind: "config-secret-snapshot",
    version: SECURE_BACKUP_VERSION,
    exportDate: input.exportDate ?? input.secrets.exportDate,
    aiConfig: input.aiConfig,
    secrets: input.secrets,
  };
}

export async function encryptScopedBackup(input: {
  scope: SecureBackupScope;
  passphrase: string;
  appVersion: string;
  payload: SecureBackupPayloadV1;
}): Promise<EncryptedScopedBackupV1> {
  ensurePassphrase(input.passphrase);

  const salt = await getRandomBytes(SALT_BYTES);
  const iv = await getRandomBytes(IV_BYTES);
  const subtle = requireSubtleCrypto();
  const key = await deriveAesKey(input.passphrase.trim(), salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(input.payload));
  const encrypted = await subtle.encrypt(
    { name: "AES-GCM", iv: toBufferSource(iv) },
    key,
    toBufferSource(plaintext),
  );

  return {
    type: "k1w1-secure-backup",
    version: SECURE_BACKUP_VERSION,
    scope: input.scope,
    exportDate: input.payload.exportDate,
    appVersion: input.appVersion,
    encryption: {
      algorithm: "AES-GCM",
      kdf: "PBKDF2-SHA-256",
      iterations: SECURE_BACKUP_PBKDF2_ITERATIONS,
      saltBase64: bytesToBase64(salt),
      ivBase64: bytesToBase64(iv),
    },
    ciphertextBase64: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export function validateEncryptedScopedBackupJson(parsed: unknown): EncryptedScopedBackupV1 {
  if (!isPlainObject(parsed)) {
    throw new Error("Ungültiges Backup-Format");
  }

  if (parsed.type === "k1w1-full-backup") {
    throw new Error(
      "Legacy-Klartext-Backups werden nicht mehr unterstützt. Bitte ein neues gesichertes Backup exportieren.",
    );
  }

  if (parsed.type !== "k1w1-secure-backup" || parsed.version !== SECURE_BACKUP_VERSION) {
    throw new Error("Ungültiges Backup-Format");
  }

  if (parsed.scope !== "secrets" && parsed.scope !== "config-secrets") {
    throw new Error("Ungültiges Backup-Format");
  }

  if (!isPlainObject(parsed.encryption)) {
    throw new Error("Ungültiges Backup-Format");
  }

  const encryption = parsed.encryption as Record<string, unknown>;
  if (
    encryption.algorithm !== "AES-GCM" ||
    encryption.kdf !== "PBKDF2-SHA-256" ||
    typeof encryption.iterations !== "number" ||
    encryption.iterations < 100000 ||
    typeof encryption.saltBase64 !== "string" ||
    typeof encryption.ivBase64 !== "string" ||
    typeof parsed.ciphertextBase64 !== "string"
  ) {
    throw new Error("Ungültiges Backup-Format");
  }

  return parsed as EncryptedScopedBackupV1;
}

function sanitizeSecretPayload(raw: unknown): SecretBackupPayloadV1 {
  if (!isPlainObject(raw) || raw.kind !== "secret-snapshot" || raw.version !== SECURE_BACKUP_VERSION) {
    throw new Error("Ungültiger Secret-Backup-Inhalt");
  }

  const connections = isPlainObject(raw.connections) ? raw.connections : {};
  const tokens = isPlainObject(raw.tokens) ? raw.tokens : {};
  const ciSecrets = isPlainObject(raw.ciSecrets) ? raw.ciSecrets : {};
  const github = isPlainObject(raw.github) ? raw.github : {};

  return {
    kind: "secret-snapshot",
    version: SECURE_BACKUP_VERSION,
    exportDate: normalizeString(raw.exportDate),
    connections: {
      supabaseRaw: normalizeString(connections.supabaseRaw),
      supabaseUrl: normalizeString(connections.supabaseUrl),
      supabaseAnonKey: normalizeString(connections.supabaseAnonKey),
      easProjectId: normalizeString(connections.easProjectId),
    },
    tokens: {
      githubToken: normalizeOptionalString(tokens.githubToken),
      expoToken: normalizeOptionalString(tokens.expoToken),
      edgeAdminKey: normalizeOptionalString(tokens.edgeAdminKey),
      workflowAdminKey:
        normalizeOptionalString(tokens.workflowAdminKey) ??
        normalizeOptionalString(tokens.edgeAdminKey),
      androidKeystoreExportAdminKey:
        normalizeOptionalString(tokens.androidKeystoreExportAdminKey) ??
        normalizeOptionalString(tokens.edgeAdminKey),
      legacyEdgeAdminKey:
        normalizeOptionalString(tokens.legacyEdgeAdminKey) ??
        normalizeOptionalString(tokens.edgeAdminKey),
      signingAdminKey:
        normalizeOptionalString(tokens.signingAdminKey) ??
        normalizeOptionalString(tokens.edgeAdminKey),
      signingMasterKey: normalizeOptionalString(tokens.signingMasterKey),
    },
    ciSecrets: Object.fromEntries(
      Object.entries(ciSecrets).map(([key, value]) => [key, normalizeString(value)]),
    ),
    github: {
      activeRepo: normalizeOptionalString(github.activeRepo),
      activeBranch: normalizeOptionalString(github.activeBranch),
      recentRepos: normalizeStringArray(github.recentRepos),
    },
  };
}

export function validateSecureBackupPayload(raw: unknown): SecureBackupPayloadV1 {
  if (!isPlainObject(raw) || raw.version !== SECURE_BACKUP_VERSION || typeof raw.exportDate !== "string") {
    throw new Error("Ungültiger Backup-Inhalt");
  }

  if (raw.kind === "secret-snapshot") {
    return sanitizeSecretPayload(raw);
  }

  if (raw.kind === "config-secret-snapshot") {
    if (!("aiConfig" in raw)) {
      throw new Error("Ungültiger Backup-Inhalt");
    }

    return {
      kind: "config-secret-snapshot",
      version: SECURE_BACKUP_VERSION,
      exportDate: normalizeString(raw.exportDate),
      aiConfig: raw.aiConfig as AIConfig,
      secrets: sanitizeSecretPayload(raw.secrets),
    };
  }

  throw new Error("Ungültiger Backup-Inhalt");
}

export async function decryptScopedBackup(input: {
  passphrase: string;
  backup: EncryptedScopedBackupV1;
}): Promise<SecureBackupPayloadV1> {
  ensurePassphrase(input.passphrase);

  const subtle = requireSubtleCrypto();
  const salt = base64ToBytes(input.backup.encryption.saltBase64);
  const iv = base64ToBytes(input.backup.encryption.ivBase64);
  const ciphertext = base64ToBytes(input.backup.ciphertextBase64);
  const key = await deriveAesKey(input.passphrase.trim(), salt);

  try {
    const decrypted = await subtle.decrypt(
      { name: "AES-GCM", iv: toBufferSource(iv) },
      key,
      toBufferSource(ciphertext),
    );
    const decoded = new TextDecoder().decode(new Uint8Array(decrypted));
    const parsed = JSON.parse(decoded) as unknown;
    return validateSecureBackupPayload(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Backup-Datei ist beschädigt oder kein gültiges JSON.");
    }
    throw new Error("Backup konnte nicht entschlüsselt werden. Passwort/PIN prüfen.");
  }
}

export function secureBackupContainsProjectContent(raw: unknown): boolean {
  const json = JSON.stringify(raw);
  return /"files"\s*:|"chatHistory"\s*:|"messages"\s*:|"projectData"\s*:/.test(json);
}
