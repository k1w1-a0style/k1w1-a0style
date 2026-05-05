import { gcm } from "@noble/ciphers/aes";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import { toBufferSource } from "./appInfoScopedBackup.cryptoHelpers";

export type SecureBackupAesKey = CryptoKey | Uint8Array;

export type SecureBackupCryptoProvider = {
  name: string;
  profile: "webcrypto" | "noble-js";
  isAvailable(): Promise<boolean> | boolean;
  getRandomBytes(length: number): Promise<Uint8Array>;
  deriveAesGcmKey(params: { passphrase: string; salt: Uint8Array; iterations: number }): Promise<SecureBackupAesKey>;
  encryptAesGcm(params: { key: SecureBackupAesKey; iv: Uint8Array; plaintext: Uint8Array }): Promise<Uint8Array>;
  decryptAesGcm(params: { key: SecureBackupAesKey; iv: Uint8Array; ciphertext: Uint8Array }): Promise<Uint8Array>;
};


function isLikelyCryptoKey(value: SecureBackupAesKey): value is CryptoKey {
  if (!value || typeof value !== "object" || value instanceof Uint8Array) return false;
  const candidate = value as Partial<CryptoKey>;
  return typeof candidate.type === "string" && Array.isArray(candidate.usages);
}

const webCryptoProvider: SecureBackupCryptoProvider = {
  name: "webcrypto-subtle",
  profile: "webcrypto",
  isAvailable: () => Boolean(globalThis.crypto?.subtle),
  async getRandomBytes(length) {
    if (globalThis.crypto?.getRandomValues) {
      return globalThis.crypto.getRandomValues(new Uint8Array(length));
    }
    const expoCrypto = await import("expo-crypto");
    return expoCrypto.getRandomBytesAsync(length);
  },
  async deriveAesGcmKey({ passphrase, salt, iterations }) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error("Secure Backup Crypto-Provider fehlt auf diesem Gerät.");
    const baseKey = await subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: toBufferSource(salt), iterations }, baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  },
  async encryptAesGcm({ key, iv, plaintext }) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || !isLikelyCryptoKey(key)) throw new Error("Secure Backup Crypto-Provider fehlt auf diesem Gerät.");
    return new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: toBufferSource(iv) }, key, toBufferSource(plaintext)));
  },
  async decryptAesGcm({ key, iv, ciphertext }) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || !isLikelyCryptoKey(key)) throw new Error("Secure Backup Crypto-Provider fehlt auf diesem Gerät.");
    return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: toBufferSource(iv) }, key, toBufferSource(ciphertext)));
  },
};

const nobleProvider: SecureBackupCryptoProvider = {
  name: "noble-js-aes-gcm-pbkdf2",
  profile: "noble-js",
  isAvailable: () => true,
  async getRandomBytes(length) {
    if (globalThis.crypto?.getRandomValues) {
      return globalThis.crypto.getRandomValues(new Uint8Array(length));
    }
    const expoCrypto = await import("expo-crypto");
    return expoCrypto.getRandomBytesAsync(length);
  },
  async deriveAesGcmKey({ passphrase, salt, iterations }) {
    return pbkdf2(sha256, new TextEncoder().encode(passphrase), salt, { c: iterations, dkLen: 32 });
  },
  async encryptAesGcm({ key, iv, plaintext }) {
    if (!(key instanceof Uint8Array)) throw new Error("Secure Backup Crypto-Provider-Schlüssel ungültig.");
    return gcm(key, iv).encrypt(plaintext);
  },
  async decryptAesGcm({ key, iv, ciphertext }) {
    if (!(key instanceof Uint8Array)) throw new Error("Secure Backup Crypto-Provider-Schlüssel ungültig.");
    return gcm(key, iv).decrypt(ciphertext);
  },
};

export async function resolveSecureBackupCryptoProvider(): Promise<SecureBackupCryptoProvider | null> {
  if (await webCryptoProvider.isAvailable()) return webCryptoProvider;
  if (await nobleProvider.isAvailable()) return nobleProvider;
  return null;
}
