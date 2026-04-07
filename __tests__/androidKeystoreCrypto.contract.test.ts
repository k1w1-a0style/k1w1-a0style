import {
  __unsafeEncryptWithAesCbcLegacyForTests,
  decryptKeystorePayload,
  encryptKeystorePayload,
  isVersionedKeystoreEnvelope,
} from "../supabase/functions/_shared/androidKeystoreCrypto";

describe("android keystore crypto contract", () => {
  const masterKey = "test-signing-master-key-0123456789";

  it("writes and reads the hardened versioned payload format", async () => {
    const payload = JSON.stringify({
      keystoreBase64: "ZmFrZS1rZXlzdG9yZQ==",
      keystorePassword: "pw-1",
      keyPassword: "pw-2",
      alias: "upload",
    });

    const encrypted = await encryptKeystorePayload(payload, masterKey);
    expect(isVersionedKeystoreEnvelope(encrypted)).toBe(true);

    const decrypted = await decryptKeystorePayload(encrypted, masterKey);
    expect(decrypted).toBe(payload);
  });

  it("fails hard on versioned payload integrity tampering", async () => {
    const encrypted = await encryptKeystorePayload("{\"s\":1}", masterKey);
    const prefix = "k1w1-ak:v3:";
    const envelopeB64 = encrypted.slice(prefix.length);
    const envelope = JSON.parse(atob(envelopeB64)) as { v: number; alg: string; iv: string; ct: string };

    envelope.ct = envelope.ct.slice(0, -1) + (envelope.ct.slice(-1) === "A" ? "B" : "A");
    const tampered = `${prefix}${btoa(JSON.stringify(envelope))}`;

    await expect(decryptKeystorePayload(tampered, masterKey)).rejects.toThrow(
      "Encrypted keystore payload failed integrity check",
    );
  });

  it("keeps legacy AES-CBC payloads readable via fallback", async () => {
    const payload = JSON.stringify({ legacy: true, alias: "upload" });
    const legacy = await __unsafeEncryptWithAesCbcLegacyForTests(payload, masterKey);

    const decrypted = await decryptKeystorePayload(legacy, masterKey);
    expect(decrypted).toBe(payload);
  });
});
