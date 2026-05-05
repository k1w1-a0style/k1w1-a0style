import { gcm } from "@noble/ciphers/aes";
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
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

export type RawAesGcmCryptoProvider = {
  name: string;
  profile: "webcrypto" | "noble-js";
  isAvailable(): Promise<boolean> | boolean;
  getRandomBytes(length: number): Promise<Uint8Array>;
  encryptAesGcmRaw(params: { rawKey: Uint8Array; iv: Uint8Array; plaintext: Uint8Array }): Promise<Uint8Array>;
  decryptAesGcmRaw(params: { rawKey: Uint8Array; iv: Uint8Array; ciphertext: Uint8Array }): Promise<Uint8Array>;
};

const CAPABILITY_PROBE_PASSPHRASE = "k1w1-capability-probe";
const CAPABILITY_PROBE_SALT = new Uint8Array(16);
const CAPABILITY_PROBE_IV = new Uint8Array(12);
const CAPABILITY_PROBE_PLAINTEXT = new TextEncoder().encode("probe");
const CAPABILITY_PROBE_ITERATIONS = 2;

async function hasSecureRandomBytes(): Promise<boolean> {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    try {
      globalThis.crypto.getRandomValues(new Uint8Array(1));
      return true;
    } catch {
      // React Native/Hermes can expose getRandomValues but still throw at runtime.
      // Continue to expo-crypto fallback instead of failing closed here.
      try {
        const expoCrypto = require("expo-crypto") as typeof import("expo-crypto");
        await expoCrypto.getRandomBytesAsync(1);
      } catch {
        // keep probe tolerant
      }
      return true;
    }
  }

  try {
    const expoCrypto = await import("expo-crypto");
    await expoCrypto.getRandomBytesAsync(1);
    return true;
  } catch {
    return false;
  }
}

function isLikelyCryptoKey(value: SecureBackupAesKey): value is CryptoKey {
  if (!value || typeof value !== "object" || value instanceof Uint8Array) return false;
  const candidate = value as Partial<CryptoKey>;
  return typeof candidate.type === "string" && Array.isArray(candidate.usages);
}

async function probeWebCryptoCapability(): Promise<boolean> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return false;
  if (!(await hasSecureRandomBytes())) return false;

  try {
    const passphraseBytes = new TextEncoder().encode(CAPABILITY_PROBE_PASSPHRASE);
    const baseKey = await subtle.importKey("raw", passphraseBytes, "PBKDF2", false, ["deriveKey"]);
    const derivedKey = await subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: toBufferSource(CAPABILITY_PROBE_SALT), iterations: CAPABILITY_PROBE_ITERATIONS },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    const ciphertext = await subtle.encrypt(
      { name: "AES-GCM", iv: toBufferSource(CAPABILITY_PROBE_IV) },
      derivedKey,
      toBufferSource(CAPABILITY_PROBE_PLAINTEXT),
    );
    const decrypted = await subtle.decrypt(
      { name: "AES-GCM", iv: toBufferSource(CAPABILITY_PROBE_IV) },
      derivedKey,
      ciphertext,
    );
    const decoded = new Uint8Array(decrypted);
    return decoded.length === CAPABILITY_PROBE_PLAINTEXT.length && decoded.every((entry, index) => entry === CAPABILITY_PROBE_PLAINTEXT[index]);
  } catch {
    return false;
  }
}

const webCryptoProvider: SecureBackupCryptoProvider = {
  name: "webcrypto-subtle",
  profile: "webcrypto",
  isAvailable: probeWebCryptoCapability,
  async getRandomBytes(length) {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
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

const webCryptoRawProvider: RawAesGcmCryptoProvider = {
  name: "webcrypto-subtle",
  profile: "webcrypto",
  isAvailable: probeWebCryptoCapability,
  getRandomBytes: webCryptoProvider.getRandomBytes,
  async encryptAesGcmRaw({ rawKey, iv, plaintext }) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error("Crypto-Provider fehlt auf diesem Gerät.");
    const key = await subtle.importKey("raw", toBufferSource(rawKey), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    return new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: toBufferSource(iv) }, key, toBufferSource(plaintext)));
  },
  async decryptAesGcmRaw({ rawKey, iv, ciphertext }) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error("Crypto-Provider fehlt auf diesem Gerät.");
    const key = await subtle.importKey("raw", toBufferSource(rawKey), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: toBufferSource(iv) }, key, toBufferSource(ciphertext)));
  },
};

const nobleProvider: SecureBackupCryptoProvider = {
  name: "noble-js-aes-gcm-pbkdf2",
  profile: "noble-js",
  isAvailable: hasSecureRandomBytes,
  async getRandomBytes(length) {
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      return globalThis.crypto.getRandomValues(new Uint8Array(length));
    }
    const expoCrypto = await import("expo-crypto");
    return expoCrypto.getRandomBytesAsync(length);
  },
  async deriveAesGcmKey({ passphrase, salt, iterations }) {
    return pbkdf2Async(sha256, new TextEncoder().encode(passphrase), salt, { c: iterations, dkLen: 32 });
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

const nobleRawProvider: RawAesGcmCryptoProvider = {
  name: "noble-js-aes-gcm-pbkdf2",
  profile: "noble-js",
  isAvailable: hasSecureRandomBytes,
  getRandomBytes: nobleProvider.getRandomBytes,
  async encryptAesGcmRaw({ rawKey, iv, plaintext }) {
    if (!(rawKey instanceof Uint8Array)) throw new Error("Crypto-Provider-Schlüssel ungültig.");
    return gcm(rawKey, iv).encrypt(plaintext);
  },
  async decryptAesGcmRaw({ rawKey, iv, ciphertext }) {
    if (!(rawKey instanceof Uint8Array)) throw new Error("Crypto-Provider-Schlüssel ungültig.");
    return gcm(rawKey, iv).decrypt(ciphertext);
  },
};

export async function resolveSecureBackupCryptoProvider(): Promise<SecureBackupCryptoProvider | null> {
  if (await webCryptoProvider.isAvailable()) return webCryptoProvider;
  if (await nobleProvider.isAvailable()) return nobleProvider;
  return null;
}

export async function resolveRawAesGcmCryptoProvider(): Promise<RawAesGcmCryptoProvider | null> {
  if (await webCryptoRawProvider.isAvailable()) return webCryptoRawProvider;
  if (await nobleRawProvider.isAvailable()) return nobleRawProvider;
  return null;
}
