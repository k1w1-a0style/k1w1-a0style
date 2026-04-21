import { Buffer } from "buffer";

import type { AIConfig } from "../contexts/AIContext/models";
import { BACKUP_AI_CONFIG_FALLBACK, sanitizeAiConfigFromBackup } from "./appInfoBackup";
import { asRecord, isRecord, readFiniteNumber, readOptionalString, readString, readStringArray, readStringRecord } from "./validation/recordReaders";

export const SECURE_BACKUP_VERSION = 1 as const;
export const SECURE_BACKUP_PBKDF2_ITERATIONS = 250000;
export const SECURE_BACKUP_LEGACY_PBKDF2_ITERATIONS = [100000, 150000] as const;
export const SECURE_BACKUP_MIN_PASSPHRASE_LENGTH = 10;
const AES_KEY_LENGTH = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const UNSUPPORTED_CRYPTO_PROFILE_ERROR = "Nicht unterstütztes oder unbekanntes Secure-Backup-Crypto-Profil.";

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
  linkedRepo: string | null;
  linkedBranch: string | null;
  recentRepos: string[];
  /** @deprecated legacy compatibility snapshot keys */
  activeRepo?: string | null;
  /** @deprecated legacy compatibility snapshot keys */
  activeBranch?: string | null;
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

type SecureBackupCryptoProfileSupport = "current-write" | "legacy-read-only";

type SecureBackupCryptoProfile = {
  support: SecureBackupCryptoProfileSupport;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA-256";
  iterations: number;
};

type SecureBackupCryptoPolicy = {
  version: typeof SECURE_BACKUP_VERSION;
  currentWrite: SecureBackupCryptoProfile;
  legacyRead: ReadonlyArray<SecureBackupCryptoProfile>;
};

export const SECURE_BACKUP_CRYPTO_POLICY: SecureBackupCryptoPolicy = {
  version: SECURE_BACKUP_VERSION,
  currentWrite: {
    support: "current-write",
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: SECURE_BACKUP_PBKDF2_ITERATIONS,
  },
  legacyRead: SECURE_BACKUP_LEGACY_PBKDF2_ITERATIONS.map((iterations) => ({
    support: "legacy-read-only",
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations,
  })),
};

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes as unknown as ArrayBufferLike).toString("base64");
}

function base64ToBytes(value: string): Uint8Array {
  const decoded = Buffer.from(value, "base64") as unknown as ArrayBufferLike;
  return new Uint8Array(decoded);
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

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = requireSubtleCrypto();
  const passphraseBytes = new TextEncoder().encode(passphrase);
  const baseKey = await subtle.importKey("raw", passphraseBytes, "PBKDF2", false, ["deriveKey"]);

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toBufferSource(salt),
      iterations,
    },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

function resolveCryptoProfileForEncryptedBackup(backup: EncryptedScopedBackupV1): SecureBackupCryptoProfile {
  if (backup.version !== SECURE_BACKUP_CRYPTO_POLICY.version) {
    throw new Error("Ungültiges Backup-Format");
  }

  if (
    backup.encryption.algorithm !== SECURE_BACKUP_CRYPTO_POLICY.currentWrite.algorithm
    || backup.encryption.kdf !== SECURE_BACKUP_CRYPTO_POLICY.currentWrite.kdf
  ) {
    throw new Error("Ungültiges Backup-Format");
  }

  if (backup.encryption.iterations === SECURE_BACKUP_CRYPTO_POLICY.currentWrite.iterations) {
    return SECURE_BACKUP_CRYPTO_POLICY.currentWrite;
  }

  const legacyProfile = SECURE_BACKUP_CRYPTO_POLICY.legacyRead.find(
    (profile) => profile.iterations === backup.encryption.iterations,
  );
  if (legacyProfile) {
    return legacyProfile;
  }

  throw new Error(UNSUPPORTED_CRYPTO_PROFILE_ERROR);
}

export function secureBackupNeedsCryptoUpgrade(backup: EncryptedScopedBackupV1): boolean {
  return resolveCryptoProfileForEncryptedBackup(backup).support !== "current-write";
}

function ensurePassphrase(passphrase: string) {
  if (typeof passphrase !== "string" || passphrase.trim().length < SECURE_BACKUP_MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Bitte eine starke Passphrase mit mindestens ${SECURE_BACKUP_MIN_PASSPHRASE_LENGTH} Zeichen eingeben.`);
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
      supabaseRaw: readString(input.connections.supabaseRaw),
      supabaseUrl: readString(input.connections.supabaseUrl),
      supabaseAnonKey: readString(input.connections.supabaseAnonKey),
      easProjectId: readString(input.connections.easProjectId),
    },
    tokens: {
      githubToken: readOptionalString(input.tokens.githubToken),
      expoToken: readOptionalString(input.tokens.expoToken),
      workflowAdminKey: readOptionalString(input.tokens.workflowAdminKey),
      androidKeystoreExportAdminKey: readOptionalString(input.tokens.androidKeystoreExportAdminKey),
      legacyEdgeAdminKey: null,
      signingAdminKey: readOptionalString(input.tokens.signingAdminKey),
      signingMasterKey: readOptionalString(input.tokens.signingMasterKey),
    },
    ciSecrets: Object.fromEntries(
      Object.entries(input.ciSecrets ?? {}).map(([key, value]) => [key, readString(value)]),
    ),
    github: {
      linkedRepo:
        readOptionalString(input.github.linkedRepo) ??
        readOptionalString(input.github.activeRepo),
      linkedBranch:
        readOptionalString(input.github.linkedBranch) ??
        readOptionalString(input.github.activeBranch),
      recentRepos: readStringArray(input.github.recentRepos),
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
  const key = await deriveAesKey(input.passphrase.trim(), salt, SECURE_BACKUP_CRYPTO_POLICY.currentWrite.iterations);
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
      algorithm: SECURE_BACKUP_CRYPTO_POLICY.currentWrite.algorithm,
      kdf: SECURE_BACKUP_CRYPTO_POLICY.currentWrite.kdf,
      iterations: SECURE_BACKUP_CRYPTO_POLICY.currentWrite.iterations,
      saltBase64: bytesToBase64(salt),
      ivBase64: bytesToBase64(iv),
    },
    ciphertextBase64: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export function validateEncryptedScopedBackupJson(parsed: unknown): EncryptedScopedBackupV1 {
  if (!isRecord(parsed)) {
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

  if (!isRecord(parsed.encryption)) {
    throw new Error("Ungültiges Backup-Format");
  }

  const encryption = asRecord(parsed.encryption);
  if (!encryption) {
    throw new Error("Ungültiges Backup-Format");
  }
  const iterations = readFiniteNumber(encryption.iterations) ?? 0;
  if (
    encryption.algorithm !== "AES-GCM" ||
    encryption.kdf !== "PBKDF2-SHA-256" ||
    typeof encryption.saltBase64 !== "string" ||
    typeof encryption.ivBase64 !== "string" ||
    typeof parsed.ciphertextBase64 !== "string"
  ) {
    throw new Error("Ungültiges Backup-Format");
  }

  const normalizedBackup = {
    ...(parsed as EncryptedScopedBackupV1),
    encryption: {
      ...((parsed as EncryptedScopedBackupV1).encryption),
      iterations,
    },
  };
  resolveCryptoProfileForEncryptedBackup(normalizedBackup);

  return normalizedBackup;
}

function sanitizeSecretPayload(raw: unknown): SecretBackupPayloadV1 {
  if (!isRecord(raw) || raw.kind !== "secret-snapshot" || raw.version !== SECURE_BACKUP_VERSION) {
    throw new Error("Ungültiger Secret-Backup-Inhalt");
  }

  const connections = asRecord(raw.connections) ?? {};
  const tokens = asRecord(raw.tokens) ?? {};
  const ciSecrets = asRecord(raw.ciSecrets) ?? {};
  const github = asRecord(raw.github) ?? {};

  return {
    kind: "secret-snapshot",
    version: SECURE_BACKUP_VERSION,
    exportDate: readString(raw.exportDate),
    connections: {
      supabaseRaw: readString(connections.supabaseRaw),
      supabaseUrl: readString(connections.supabaseUrl),
      supabaseAnonKey: readString(connections.supabaseAnonKey),
      easProjectId: readString(connections.easProjectId),
    },
    tokens: {
      githubToken: readOptionalString(tokens.githubToken),
      expoToken: readOptionalString(tokens.expoToken),
      edgeAdminKey: readOptionalString(tokens.edgeAdminKey),
      workflowAdminKey:
        readOptionalString(tokens.workflowAdminKey) ??
        readOptionalString(tokens.edgeAdminKey),
      androidKeystoreExportAdminKey: readOptionalString(tokens.androidKeystoreExportAdminKey),
      legacyEdgeAdminKey:
        readOptionalString(tokens.legacyEdgeAdminKey) ??
        readOptionalString(tokens.edgeAdminKey),
      signingAdminKey: readOptionalString(tokens.signingAdminKey),
      signingMasterKey: readOptionalString(tokens.signingMasterKey),
    },
    ciSecrets: readStringRecord(ciSecrets) ?? {},
    github: {
      linkedRepo:
        readOptionalString(github.linkedRepo) ??
        readOptionalString(github.activeRepo),
      linkedBranch:
        readOptionalString(github.linkedBranch) ??
        readOptionalString(github.activeBranch),
      recentRepos: readStringArray(github.recentRepos),
    },
  };
}

export function validateSecureBackupPayload(raw: unknown): SecureBackupPayloadV1 {
  if (!isRecord(raw) || raw.version !== SECURE_BACKUP_VERSION || typeof raw.exportDate !== "string") {
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
      exportDate: readString(raw.exportDate),
      aiConfig: sanitizeAiConfigFromBackup(raw.aiConfig, BACKUP_AI_CONFIG_FALLBACK),
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
  const key = await deriveAesKey(input.passphrase.trim(), salt, input.backup.encryption.iterations);

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
    throw new Error("Backup konnte nicht entschlüsselt werden. Passphrase prüfen.");
  }
}

export function secureBackupContainsProjectContent(raw: unknown): boolean {
  const json = JSON.stringify(raw);
  return /"files"\s*:|"chatHistory"\s*:|"messages"\s*:|"projectData"\s*:/.test(json);
}
