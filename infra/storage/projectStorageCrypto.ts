import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import * as ExpoCrypto from "expo-crypto";

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

function toBufferSource(bytes: Uint8Array): BufferSource {
  const sliced = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Uint8Array(sliced) as unknown as BufferSource;
}

function requireSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto/AES-GCM ist für Projekt-Persistenz auf diesem Gerät nicht verfügbar.");
  }
  return subtle;
}

async function getRandomBytes(length: number): Promise<Uint8Array> {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint8Array(length));
  }
  return ExpoCrypto.getRandomBytesAsync(length);
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
  const stored = await SecureStore.getItemAsync(PROJECT_STORAGE_ENCRYPTION_KEY);
  if (typeof stored === "string" && stored.trim()) {
    return decodeStoredProjectKeyOrThrow(stored);
  }
  if (stored !== null && typeof stored !== "undefined") {
    throw new Error("Projekt-Schluessel im SecureStore ist ungueltig.");
  }
  const freshKey = await getRandomBytes(AES_KEY_LENGTH_BYTES);
  await SecureStore.setItemAsync(PROJECT_STORAGE_ENCRYPTION_KEY, bytesToBase64(freshKey));
  return freshKey;
}

async function getProjectStorageCryptoKey(mode: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const subtle = requireSubtleCrypto();
  const raw = mode === "encrypt"
    ? await getOrCreateProjectStorageKeyBytesForEncrypt()
    : await getExistingProjectStorageKeyBytesOrThrow();
  return subtle.importKey("raw", toBufferSource(raw), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
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

  const subtle = requireSubtleCrypto();
  const key = await getProjectStorageCryptoKey("encrypt");
  const iv = await getRandomBytes(IV_BYTES);
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: toBufferSource(iv) }, key, toBufferSource(encoded));

  const payload: EncryptedProjectStoragePayloadV1 = {
    type: ENCRYPTED_PROJECT_BLOB_TYPE,
    version: ENCRYPTED_PROJECT_BLOB_VERSION,
    algorithm: "AES-GCM",
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(new Uint8Array(ciphertext)),
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

  const subtle = requireSubtleCrypto();
  const key = await getProjectStorageCryptoKey("decrypt");
  const iv = base64ToBytes(parsed.ivBase64);
  const ciphertext = base64ToBytes(parsed.ciphertextBase64);
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: toBufferSource(iv) },
    key,
    toBufferSource(ciphertext),
  );
  return new TextDecoder().decode(new Uint8Array(plaintext));
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
