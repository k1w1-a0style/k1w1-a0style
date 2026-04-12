import { Buffer } from "buffer";
import sodium from "libsodium-wrappers-sumo";

// ✅ FIX: Buffer Polyfill Check (lazy + zuverlässig)
export const ensureBuffer = () => {
  if (typeof Buffer === "undefined" || typeof Buffer.from !== "function") {
    throw new Error(
      '❌ Buffer polyfill fehlt oder ist unvollständig. Bitte "buffer" Package installieren: npm install buffer',
    );
  }
};

// Unterstützt "base64:" prefix für Binärdateien (z.B. PNG im Template).
// - Wenn content mit "base64:" beginnt, wird der Rest 1:1 als Base64 an GitHub gesendet.
// - Sonst wird UTF-8 Inhalt normal base64-encodiert.
export const encodeGitHubFileContent = (content: string): string => {
  ensureBuffer();
  const trimmed = (content ?? "").toString();
  if (trimmed.startsWith("base64:")) {
    return trimmed.slice("base64:".length).trim();
  }
  return Buffer.from(trimmed, "utf8").toString("base64");
};

export const encryptSecret = async (publicKey: string, value: string): Promise<string> => {
  ensureBuffer();
  await sodium.ready;
  if (!sodium.crypto_box_seal) {
    throw new Error("libsodium crypto_box_seal ist nicht verfügbar.");
  }
  const messageBytes = Buffer.from(value);
  const keyBytes = Buffer.from(publicKey, "base64");
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString("base64");
};
