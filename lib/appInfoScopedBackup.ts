import type { AIConfig } from "../contexts/AIContext/models";
import { BACKUP_AI_CONFIG_FALLBACK, sanitizeAiConfigFromBackup } from "./appInfoBackup";
import { asRecord, isRecord, readFiniteNumber, readString } from "./validation/recordReaders";
import { base64ToBytes, bytesToBase64 } from "./appInfoScopedBackup.cryptoHelpers";
import { resolveSecureBackupCryptoProvider } from "./appInfoScopedBackup.cryptoProvider";
import {
  buildCiSecretsSnapshot,
  buildSecretConnectionsSnapshot,
  buildSecretGithubContext,
  buildSecretTokensSnapshot,
  sanitizeSecretPayloadRecord,
} from "./appInfoScopedBackup.helpers";

export const SECURE_BACKUP_VERSION = 1 as const;
export const SECURE_BACKUP_PBKDF2_ITERATIONS = 250000;
export const SECURE_BACKUP_LEGACY_PBKDF2_ITERATIONS = [100000, 150000] as const;
export const SECURE_BACKUP_MIN_PASSPHRASE_LENGTH = 10;
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


export type SecureBackupCryptoRuntimeStatus = {
  available: boolean;
  providerName: string | null;
  providerProfile: "webcrypto" | "noble-js" | null;
};

export async function getSecureBackupCryptoRuntimeStatus(): Promise<SecureBackupCryptoRuntimeStatus> {
  const provider = await resolveSecureBackupCryptoProvider();
  return {
    available: Boolean(provider),
    providerName: provider?.name ?? null,
    providerProfile: provider?.profile ?? null,
  };
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
    connections: buildSecretConnectionsSnapshot(input.connections),
    tokens: buildSecretTokensSnapshot(input.tokens),
    ciSecrets: buildCiSecretsSnapshot(input.ciSecrets),
    github: buildSecretGithubContext(input.github),
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

  const provider = await resolveSecureBackupCryptoProvider();
  if (!provider) {
    throw new Error("Gesichertes Backup ist auf diesem Gerät nicht verfügbar: Crypto-Provider fehlt. Backup wurde nicht erstellt.");
  }

  const salt = await provider.getRandomBytes(SALT_BYTES);
  const iv = await provider.getRandomBytes(IV_BYTES);
  const key = await provider.deriveAesGcmKey({
    passphrase: input.passphrase.trim(),
    salt,
    iterations: SECURE_BACKUP_CRYPTO_POLICY.currentWrite.iterations,
  });
  const plaintext = new TextEncoder().encode(JSON.stringify(input.payload));
  const encrypted = await provider.encryptAesGcm({ key, iv, plaintext });

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
  const iterations = readFiniteNumber(encryption.iterations);
  if (typeof iterations !== "number") {
    throw new Error("Ungültiges Backup-Format");
  }
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
  return sanitizeSecretPayloadRecord(raw, SECURE_BACKUP_VERSION);
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

  const provider = await resolveSecureBackupCryptoProvider();
  if (!provider) {
    throw new Error("Gesichertes Backup ist auf diesem Gerät nicht verfügbar: Crypto-Provider fehlt.");
  }
  const salt = base64ToBytes(input.backup.encryption.saltBase64);
  const iv = base64ToBytes(input.backup.encryption.ivBase64);
  const ciphertext = base64ToBytes(input.backup.ciphertextBase64);
  const key = await provider.deriveAesGcmKey({
    passphrase: input.passphrase.trim(),
    salt,
    iterations: input.backup.encryption.iterations,
  });

  try {
    const decrypted = await provider.decryptAesGcm({ key, iv, ciphertext });
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
