import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import {
  resolveRawAesGcmCryptoProviderForDecrypt,
  resolveRawAesGcmCryptoProviderForEncrypt,
} from "../../lib/appInfoScopedBackup.cryptoProvider";

const PROJECT_STORAGE_ENCRYPTION_KEY = "k1w1_project_storage_key_v1";
const ENCRYPTED_PROJECT_BLOB_TYPE = "k1w1-project-storage";
const ENCRYPTED_PROJECT_BLOB_VERSION = 1 as const;
const AES_KEY_LENGTH_BYTES = 32;
const IV_BYTES = 12;

export type EncryptedProjectStoragePayloadV1 = {
  type: typeof ENCRYPTED_PROJECT_BLOB_TYPE;
  version: typeof ENCRYPTED_PROJECT_BLOB_VERSION;
  algorithm: "AES-GCM";
  ivBase64: string;
  ciphertextBase64: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function requireProjectStorageCryptoProvider() {
  const provider = await resolveRawAesGcmCryptoProviderForEncrypt();
  if (!provider) {
    throw new Error("Projekt-Persistenz-Crypto-Provider fehlt auf diesem Gerät.");
  }
  return provider;
}

async function requireProjectStorageDecryptCryptoProvider() {
  const provider = await resolveRawAesGcmCryptoProviderForDecrypt();
  if (!provider) {
    throw new Error("Projekt-Persistenz-Decrypt-Crypto-Provider fehlt auf diesem Gerät.");
  }
  return provider;
}

function decodeStoredProjectKeyOrThrow(stored: string): Uint8Array {
  const bytes = base64ToBytes(stored);
  if (bytes.byteLength !== AES_KEY_LENGTH_BYTES) {
    throw new Error("Projekt-Schluessel im SecureStore hat ein ungueltiges Format.");
  }
  return bytes;
}

async function getExistingProjectStorageKeyBytesOrThrow(): Promise<Uint8Array> {
  const stored = await SecureStore.getItemAsync(PROJECT_STORAGE_ENCRYPTION_KEY);
  if (typeof stored === "string" && stored.trim()) {
    return decodeStoredProjectKeyOrThrow(stored);
  }
  throw new Error("Projekt-Schluessel fehlt im SecureStore.");
}

async function getOrCreateProjectStorageKeyBytesForEncrypt(): Promise<Uint8Array> {
  const provider = await requireProjectStorageCryptoProvider();
  const stored = await SecureStore.getItemAsync(PROJECT_STORAGE_ENCRYPTION_KEY);
  if (typeof stored === "string" && stored.trim()) {
    return decodeStoredProjectKeyOrThrow(stored);
  }
  if (stored !== null && typeof stored !== "undefined") {
    throw new Error("Projekt-Schluessel im SecureStore ist ungueltig.");
  }
  const freshKey = await provider.getRandomBytes(AES_KEY_LENGTH_BYTES);
  await SecureStore.setItemAsync(PROJECT_STORAGE_ENCRYPTION_KEY, bytesToBase64(freshKey));
  return freshKey;
}

export function isEncryptedProjectStoragePayload(value: unknown): value is EncryptedProjectStoragePayloadV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.type === ENCRYPTED_PROJECT_BLOB_TYPE &&
    record.version === ENCRYPTED_PROJECT_BLOB_VERSION &&
    record.algorithm === "AES-GCM" &&
    typeof record.ivBase64 === "string" &&
    typeof record.ciphertextBase64 === "string"
  );
}

export async function encryptProjectStoragePayload(plaintext: string): Promise<string> {
  if (typeof plaintext !== "string" || !plaintext.length) {
    throw new Error("Projektzustand ist leer und kann nicht verschlüsselt werden.");
  }

  const provider = await requireProjectStorageCryptoProvider();
  const key = await getOrCreateProjectStorageKeyBytesForEncrypt();
  const iv = await provider.getRandomBytes(IV_BYTES);
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await provider.encryptAesGcmRaw({ rawKey: key, iv, plaintext: encoded });

  const payload: EncryptedProjectStoragePayloadV1 = {
    type: ENCRYPTED_PROJECT_BLOB_TYPE,
    version: ENCRYPTED_PROJECT_BLOB_VERSION,
    algorithm: "AES-GCM",
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(ciphertext),
  };

  return JSON.stringify(payload);
}

function parseProjectStorageJson(serialized: string): unknown {
  try {
    return JSON.parse(serialized) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Projektzustand konnte nicht gelesen werden: kein gültiges JSON (${reason}).`,
    );
  }
}

export async function decryptProjectStoragePayload(serialized: string): Promise<string> {
  const parsed = parseProjectStorageJson(serialized);
  if (!isEncryptedProjectStoragePayload(parsed)) {
    throw new Error("Projektzustand ist nicht im erwarteten verschlüsselten Format gespeichert.");
  }

  const provider = await requireProjectStorageDecryptCryptoProvider();
  const key = await getExistingProjectStorageKeyBytesOrThrow();
  const iv = base64ToBytes(parsed.ivBase64);
  const ciphertext = base64ToBytes(parsed.ciphertextBase64);
  const plaintext = await provider.decryptAesGcmRaw({ rawKey: key, iv, ciphertext });
  return new TextDecoder().decode(plaintext);
}

export async function deserializeProjectStoragePayload(serialized: string): Promise<{
  projectString: string;
  migratedFromPlaintext: boolean;
}> {
  const parsed = parseProjectStorageJson(serialized);
  if (isEncryptedProjectStoragePayload(parsed)) {
    const projectString = await decryptProjectStoragePayload(serialized);
    return { projectString, migratedFromPlaintext: false };
  }

  return {
    projectString: serialized,
    migratedFromPlaintext: true,
  };
}

export function looksLikeEncryptedProjectStoragePayload(serialized: string): boolean {
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return isEncryptedProjectStoragePayload(parsed);
  } catch {
    return false;
  }
}
