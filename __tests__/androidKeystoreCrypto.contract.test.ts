import {
  __unsafeEncryptWithAesGcmLegacyV2ForTests,
  __unsafeEncryptWithAesCbcLegacyForTests,
  decryptKeystorePayload,
  decryptKeystorePayloadWithMigration,
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

  it("migrates a successful legacy v2 read into a persisted v3 payload", async () => {
    const payload = JSON.stringify({ alias: "upload", migrated: true });
    const legacyV2 = await __unsafeEncryptWithAesGcmLegacyV2ForTests(payload, masterKey);
    let persistedV3 = "";

    const decrypted = await decryptKeystorePayloadWithMigration(legacyV2, masterKey, async (nextPayload) => {
      persistedV3 = nextPayload;
    });

    expect(decrypted).toBe(payload);
    expect(persistedV3.startsWith("k1w1-ak:v3:")).toBe(true);
    await expect(decryptKeystorePayload(persistedV3, masterKey)).resolves.toBe(payload);
  });

  it("uses best-effort honesty: legacy read fails when v3 migration persistence fails", async () => {
    const payload = JSON.stringify({ alias: "upload", migrated: "must-fail" });
    const legacyV2 = await __unsafeEncryptWithAesGcmLegacyV2ForTests(payload, masterKey);

    await expect(
      decryptKeystorePayloadWithMigration(legacyV2, masterKey, async () => {
        throw new Error("simulated storage write failure");
      }),
    ).rejects.toThrow("Legacy keystore payload decrypted but v3 migration persistence failed");
  });

  it("does not rewrite already-current v3 payloads during migration-aware decrypt", async () => {
    const payload = JSON.stringify({ alias: "upload", current: true });
    const currentV3 = await encryptKeystorePayload(payload, masterKey);
    const persistSpy = jest.fn<Promise<void>, [string]>(async () => {});

    const decrypted = await decryptKeystorePayloadWithMigration(currentV3, masterKey, persistSpy);

    expect(decrypted).toBe(payload);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it("does not route non-versioned non-ciphertext payloads into legacy AES-CBC decrypt", async () => {
    await expect(decryptKeystorePayload("not-a-legacy-ciphertext", masterKey)).rejects.toThrow(
      "Encrypted keystore payload contract mismatch",
    );
  });

});
