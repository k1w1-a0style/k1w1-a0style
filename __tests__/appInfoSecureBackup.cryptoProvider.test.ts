import { resolveSecureBackupCryptoProvider } from "../lib/appInfoScopedBackup.cryptoProvider";
import {
  createSecretBackupPayload,
  decryptScopedBackup,
  encryptScopedBackup,
  getSecureBackupCryptoRuntimeStatus,
} from "../lib/appInfoScopedBackup";

describe("secure backup crypto provider", () => {
  const originalCrypto = global.crypto;
  afterEach(() => {
    Object.defineProperty(global, "crypto", { value: originalCrypto, configurable: true });
  });

  test("uses webcrypto provider when subtle is available", async () => {
    Object.defineProperty(global, "crypto", { value: require("crypto").webcrypto, configurable: true });
    const provider = await resolveSecureBackupCryptoProvider();
    expect(provider?.profile).toBe("webcrypto");
  });


  test("runtime crypto status exposes provider metadata", async () => {
    Object.defineProperty(global, "crypto", { value: require("crypto").webcrypto, configurable: true });
    const status = await getSecureBackupCryptoRuntimeStatus();
    expect(status.available).toBe(true);
    expect(status.providerProfile).toBe("webcrypto");
    expect(status.providerName).toBe("webcrypto-subtle");
  });



  test("falls back to noble when subtle exists but required methods are missing", async () => {
    const webcrypto = require("crypto").webcrypto;
    Object.defineProperty(global, "crypto", {
      value: {
        getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
        subtle: {},
      },
      configurable: true,
    });
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

      Object.defineProperty(global, "crypto", { value: undefined, configurable: true });

      const provider = await resolveSecureBackupCryptoProvider();
      expect(provider).toBeNull();
    } finally {
      expoCrypto.getRandomBytesAsync = originalGetRandomBytesAsync;
    }
  });

  test("uses noble-js provider when subtle is unavailable", async () => {
    Object.defineProperty(global, "crypto", { value: { getRandomValues: require("crypto").webcrypto.getRandomValues.bind(require("crypto").webcrypto) }, configurable: true });
    const provider = await resolveSecureBackupCryptoProvider();
    expect(provider?.profile).toBe("noble-js");
  });


  test("cross-provider: webcrypto encrypt -> noble decrypt", async () => {
    const webcrypto = require("crypto").webcrypto;
    Object.defineProperty(global, "crypto", { value: webcrypto, configurable: true });

    const payload = createSecretBackupPayload({
      connections: { supabaseRaw: "r", supabaseUrl: "u", supabaseAnonKey: "a", easProjectId: "e" },
      tokens: { githubToken: "g", expoToken: "e", workflowAdminKey: "w", androidKeystoreExportAdminKey: "k", legacyEdgeAdminKey: null, signingAdminKey: "s", signingMasterKey: "m" },
      ciSecrets: {},
      github: { linkedRepo: null, linkedBranch: null, recentRepos: [] },
    });

    const encrypted = await encryptScopedBackup({ scope: "secrets", passphrase: "correct-horse", appVersion: "1.0.0", payload });

    Object.defineProperty(global, "crypto", {
      value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
      configurable: true,
    });

    const decrypted = await decryptScopedBackup({ passphrase: "correct-horse", backup: encrypted });
    expect(decrypted.kind).toBe("secret-snapshot");
  });

  test("cross-provider: noble encrypt -> webcrypto decrypt", async () => {
    const webcrypto = require("crypto").webcrypto;
    Object.defineProperty(global, "crypto", {
      value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
      configurable: true,
    });

    const payload = createSecretBackupPayload({
      connections: { supabaseRaw: "r", supabaseUrl: "u", supabaseAnonKey: "a", easProjectId: "e" },
      tokens: { githubToken: "g", expoToken: "e", workflowAdminKey: "w", androidKeystoreExportAdminKey: "k", legacyEdgeAdminKey: null, signingAdminKey: "s", signingMasterKey: "m" },
      ciSecrets: {},
      github: { linkedRepo: null, linkedBranch: null, recentRepos: [] },
    });

    const encrypted = await encryptScopedBackup({ scope: "secrets", passphrase: "correct-horse", appVersion: "1.0.0", payload });

    Object.defineProperty(global, "crypto", { value: webcrypto, configurable: true });

    const decrypted = await decryptScopedBackup({ passphrase: "correct-horse", backup: encrypted });
    expect(decrypted.kind).toBe("secret-snapshot");
  });

  test("roundtrip still works without subtle", async () => {
    Object.defineProperty(global, "crypto", { value: { getRandomValues: require("crypto").webcrypto.getRandomValues.bind(require("crypto").webcrypto) }, configurable: true });
    const payload = createSecretBackupPayload({
      connections: { supabaseRaw: "r", supabaseUrl: "u", supabaseAnonKey: "a", easProjectId: "e" },
      tokens: { githubToken: "g", expoToken: "e", workflowAdminKey: "w", androidKeystoreExportAdminKey: "k", legacyEdgeAdminKey: null, signingAdminKey: "s", signingMasterKey: "m" },
      ciSecrets: {},
      github: { linkedRepo: null, linkedBranch: null, recentRepos: [] },
    });
    const encrypted = await encryptScopedBackup({ scope: "secrets", passphrase: "correct-horse", appVersion: "1.0.0", payload });
    const decrypted = await decryptScopedBackup({ passphrase: "correct-horse", backup: encrypted });
    expect(decrypted.kind).toBe("secret-snapshot");
  });
});
