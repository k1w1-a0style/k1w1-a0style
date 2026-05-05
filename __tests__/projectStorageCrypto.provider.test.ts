import * as SecureStore from "expo-secure-store";
import { webcrypto } from "crypto";

import {
  decryptProjectStoragePayload,
  deserializeProjectStoragePayload,
  encryptProjectStoragePayload,
} from "../infra/storage/projectStorageCrypto";

type SecureStoreMock = typeof SecureStore & {
  __resetMockStorage?: () => void;
  __setMockStorage?: (next: Record<string, string>) => void;
};

function setCrypto(value: unknown) {
  Object.defineProperty(global, "crypto", { value, configurable: true });
}

describe("project storage crypto provider fallback", () => {
  const originalCrypto = global.crypto;
  const rngOnlyCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };

  beforeEach(() => {
    (SecureStore as SecureStoreMock).__resetMockStorage?.();
  });

  afterEach(() => {
    setCrypto(originalCrypto);
    jest.restoreAllMocks();
  });

  test("fallbacks to noble without subtle and roundtrips encrypted payload", async () => {
    setCrypto(rngOnlyCrypto);
    const plaintext = '{"name":"Secret Project","files":[{"path":"src/secrets.ts","content":"token=abc"}] }';

    const encrypted = await encryptProjectStoragePayload(plaintext);
    expect(encrypted).toContain('"type":"k1w1-project-storage"');
    expect(encrypted).not.toContain("Secret Project");
    expect(encrypted).not.toContain("token=abc");

    const decrypted = await decryptProjectStoragePayload(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  test("cross-provider compatibility both directions", async () => {
    setCrypto(webcrypto);
    const webEncrypted = await encryptProjectStoragePayload('{"name":"w"}');

    setCrypto(rngOnlyCrypto);
    await expect(decryptProjectStoragePayload(webEncrypted)).resolves.toBe('{"name":"w"}');

    const nobleEncrypted = await encryptProjectStoragePayload('{"name":"n"}');
    setCrypto(webcrypto);
    await expect(decryptProjectStoragePayload(nobleEncrypted)).resolves.toBe('{"name":"n"}');
  });

  test("decrypt without secure-store key fails safely", async () => {
    setCrypto(webcrypto);
    const encrypted = await encryptProjectStoragePayload('{"name":"x"}');
    (SecureStore as SecureStoreMock).__resetMockStorage?.();
    await expect(decryptProjectStoragePayload(encrypted)).rejects.toThrow(/Schluessel fehlt/i);
  });

  test("deserialize legacy plaintext marks migration", async () => {
    const raw = '{"name":"legacy"}';
    const parsed = await deserializeProjectStoragePayload(raw);
    expect(parsed.migratedFromPlaintext).toBe(true);
    expect(parsed.projectString).toBe(raw);
  });
});
