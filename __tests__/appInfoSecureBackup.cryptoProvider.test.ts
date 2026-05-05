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



  test("does not select webcrypto when pbkdf2/aes-gcm probe fails", async () => {
    const subtleMock = {
      importKey: jest.fn(async () => ({ type: "secret", usages: ["deriveKey"] })),
      deriveKey: jest.fn(async () => {
        const error = new Error("NotSupportedError");
        error.name = "NotSupportedError";
        throw error;
      }),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };
    setCrypto({ getRandomValues: rngOnlyCrypto.getRandomValues, subtle: subtleMock });
    const provider = await resolveSecureBackupCryptoProvider();
    expect(provider?.profile).toBe("noble-js");
  });

  test("webcrypto availability requires rng capability", async () => {
    const expoCrypto = jest.requireMock("expo-crypto");
    const originalGetRandomBytesAsync = expoCrypto.getRandomBytesAsync;
    try {
      expoCrypto.getRandomBytesAsync = jest.fn(async () => {
        throw new Error("rng unavailable");
      });

      setCrypto({ subtle: webcrypto.subtle });
      const provider = await resolveSecureBackupCryptoProvider();
      expect(provider?.profile).not.toBe("webcrypto");

      const status = await getSecureBackupCryptoRuntimeStatus();
      expect(status.providerProfile).not.toBe("webcrypto");
    } finally {
      expoCrypto.getRandomBytesAsync = originalGetRandomBytesAsync;
    }
  });


  test("falls back to expo RNG when getRandomValues exists but throws", async () => {
    const expoCrypto = jest.requireMock("expo-crypto");
    const originalGetRandomBytesAsync = expoCrypto.getRandomBytesAsync;
    try {
      expoCrypto.getRandomBytesAsync = jest.fn(async (length: number) => new Uint8Array(length));

      setCrypto({
        getRandomValues: jest.fn(() => {
          throw new Error("RNG runtime failure");
        }),
      });

      const provider = await resolveSecureBackupCryptoProvider();
      expect(provider?.profile).toBe("noble-js");
      expect(expoCrypto.getRandomBytesAsync).toHaveBeenCalled();
    } finally {
      expoCrypto.getRandomBytesAsync = originalGetRandomBytesAsync;
    }
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



  test("encrypt stays fail-closed when no provider is available", async () => {
    const expoCrypto = jest.requireMock("expo-crypto");
    const originalGetRandomBytesAsync = expoCrypto.getRandomBytesAsync;
    try {
      expoCrypto.getRandomBytesAsync = jest.fn(async () => {
        throw new Error("rng unavailable");
      });

      setCrypto(undefined);
      await expect(
        encryptScopedBackup({
          scope: "secrets",
          passphrase: "correct-horse",
          appVersion: "1.0.0",
          payload: makePayload(),
        }),
      ).rejects.toThrow("Crypto-Provider fehlt");
    } finally {
      expoCrypto.getRandomBytesAsync = originalGetRandomBytesAsync;
    }
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
