import { webcrypto } from "crypto";

import { resolveSecureBackupCryptoProvider } from "../lib/appInfoScopedBackup.cryptoProvider";
import {
  createSecretBackupPayload,
  decryptScopedBackup,
  encryptScopedBackup,
  getSecureBackupCryptoRuntimeStatus,
} from "../lib/appInfoScopedBackup";

function setCrypto(value: unknown) {
  Object.defineProperty(global, "crypto", { value, configurable: true });
}

function makePayload() {
  return createSecretBackupPayload({
    connections: { supabaseRaw: "r", supabaseUrl: "u", supabaseAnonKey: "a", easProjectId: "e" },
    tokens: {
      githubToken: "g",
      expoToken: "e",
      workflowAdminKey: "w",
      androidKeystoreExportAdminKey: "k",
      legacyEdgeAdminKey: null,
      signingAdminKey: "s",
      signingMasterKey: "m",
    },
    ciSecrets: {},
    github: { linkedRepo: null, linkedBranch: null, recentRepos: [] },
  });
}

describe("secure backup crypto provider", () => {
  const originalCrypto = global.crypto;
  const rngOnlyCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };

  afterEach(() => {
    setCrypto(originalCrypto);
  });

  test("uses webcrypto provider when subtle is available", async () => {
    setCrypto(webcrypto);
    const provider = await resolveSecureBackupCryptoProvider();
    expect(provider?.profile).toBe("webcrypto");
  });

  test("runtime crypto status exposes provider metadata", async () => {
    setCrypto(webcrypto);
    const status = await getSecureBackupCryptoRuntimeStatus();
    expect(status.available).toBe(true);
    expect(status.providerProfile).toBe("webcrypto");
    expect(status.providerName).toBe("webcrypto-subtle");
  });

  test("falls back to noble when subtle exists but required methods are missing", async () => {
    setCrypto({ getRandomValues: rngOnlyCrypto.getRandomValues, subtle: {} });
    const provider = await resolveSecureBackupCryptoProvider();
    expect(provider?.profile).toBe("noble-js");
  });

  test("returns null provider when neither webcrypto nor secure RNG fallback is available", async () => {
    const expoCrypto = jest.requireMock("expo-crypto");
    const originalGetRandomBytesAsync = expoCrypto.getRandomBytesAsync;
    try {
      expoCrypto.getRandomBytesAsync = jest.fn(async () => {
        throw new Error("rng unavailable");
      });

      setCrypto(undefined);
      const provider = await resolveSecureBackupCryptoProvider();
      expect(provider).toBeNull();
    } finally {
      expoCrypto.getRandomBytesAsync = originalGetRandomBytesAsync;
    }
  });

  test("uses noble-js provider when subtle is unavailable", async () => {
    setCrypto(rngOnlyCrypto);
    const provider = await resolveSecureBackupCryptoProvider();
    expect(provider?.profile).toBe("noble-js");
  });

  test("cross-provider: webcrypto encrypt -> noble decrypt", async () => {
    setCrypto(webcrypto);
    const encrypted = await encryptScopedBackup({
      scope: "secrets",
      passphrase: "correct-horse",
      appVersion: "1.0.0",
      payload: makePayload(),
    });

    setCrypto(rngOnlyCrypto);
    const decrypted = await decryptScopedBackup({ passphrase: "correct-horse", backup: encrypted });
    expect(decrypted.kind).toBe("secret-snapshot");
  });

  test("cross-provider: noble encrypt -> webcrypto decrypt", async () => {
    setCrypto(rngOnlyCrypto);
    const encrypted = await encryptScopedBackup({
      scope: "secrets",
      passphrase: "correct-horse",
      appVersion: "1.0.0",
      payload: makePayload(),
    });

    setCrypto(webcrypto);
    const decrypted = await decryptScopedBackup({ passphrase: "correct-horse", backup: encrypted });
    expect(decrypted.kind).toBe("secret-snapshot");
  });

  test("roundtrip still works without subtle", async () => {
    setCrypto(rngOnlyCrypto);
    const encrypted = await encryptScopedBackup({
      scope: "secrets",
      passphrase: "correct-horse",
      appVersion: "1.0.0",
      payload: makePayload(),
    });
    const decrypted = await decryptScopedBackup({ passphrase: "correct-horse", backup: encrypted });
    expect(decrypted.kind).toBe("secret-snapshot");
  });
});
