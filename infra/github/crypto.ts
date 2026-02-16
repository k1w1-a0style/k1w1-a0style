import { seal } from "tweetsodium";
import { Buffer } from "buffer";

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

export const encryptSecret = (publicKey: string, value: string): string => {
  ensureBuffer();
  const messageBytes = Buffer.from(value);
  const keyBytes = Buffer.from(publicKey, "base64");
  const encryptedBytes = seal(messageBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString("base64");
};
